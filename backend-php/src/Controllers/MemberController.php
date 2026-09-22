<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Acl;
use Gymlic\Auth;
use Gymlic\Cast;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Uuid;
use Gymlic\Validate;
use Throwable;

final class MemberController
{
    private const INVITE_EXPIRES_DAYS = 14;

    public static function listMembers(array $params): void
    {
        $user = Auth::requireUser();
        $clubId = $params['id'];
        Acl::require(Acl::managesClub($user['id'], $clubId));

        $stmt = Database::connection()->prepare(
            "SELECT m.id, m.user_id, m.plan_id, m.status, m.joined_at, m.expires_at,
                    p.first_name, p.last_name, p.phone, p.avatar_url,
                    cmp.name AS plan_name
             FROM memberships m
             JOIN profiles p ON p.id = m.user_id
             LEFT JOIN club_membership_plans cmp ON cmp.id = m.plan_id
             WHERE m.club_id = :club_id AND m.role = 'athlete'
             ORDER BY m.joined_at DESC"
        );
        $stmt->execute(['club_id' => $clubId]);

        Response::ok(['items' => $stmt->fetchAll()]);
    }

    public static function listInvites(array $params): void
    {
        $user = Auth::requireUser();
        $clubId = $params['id'];
        Acl::require(Acl::managesClub($user['id'], $clubId));

        Response::ok(['items' => self::pendingInvites($clubId)]);
    }

    public static function listTrainerOptions(array $params): void
    {
        $user = Auth::requireUser();
        $clubId = $params['id'];
        Acl::require(Acl::managesClub($user['id'], $clubId));

        $stmt = Database::connection()->prepare(
            "SELECT m.user_id AS id, p.first_name, p.last_name
             FROM memberships m
             JOIN profiles p ON p.id = m.user_id
             WHERE m.club_id = :club_id AND m.role = 'trainer' AND m.status = 'active'"
        );
        $stmt->execute(['club_id' => $clubId]);

        Response::ok(['items' => $stmt->fetchAll()]);
    }

    public static function capacity(array $params): void
    {
        $user = Auth::requireUser();
        $clubId = $params['id'];
        Acl::require(Acl::isClubMember($user['id'], $clubId));

        Response::ok(self::capacitySnapshot(Database::connection(), $clubId));
    }

    /**
     * The capacity check runs inside the transaction that creates the invite,
     * locking the club row: the browser used to read the count and insert in
     * two round trips, so two managers could both pass the check.
     */
    public static function createInvite(array $params): void
    {
        $user = Auth::requireUser();
        $clubId = $params['id'];
        Acl::require(Acl::managesClub($user['id'], $clubId));

        $data = Validate::body();
        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $club = $pdo->prepare('SELECT member_capacity FROM clubs WHERE id = :id FOR UPDATE');
            $club->execute(['id' => $clubId]);
            $row = $club->fetch();

            if ($row === false) {
                throw new \RuntimeException('club_not_found');
            }

            $snapshot = self::capacitySnapshot($pdo, $clubId);
            if ($snapshot['capacity'] !== null
                && $snapshot['active_members'] + $snapshot['pending_invites'] >= $snapshot['capacity']) {
                throw new \RuntimeException('capacity_full');
            }

            $code = Uuid::v4();
            $pdo->prepare(
                "INSERT INTO invitations (id, code, club_id, trainer_id, invited_role, created_by,
                                          first_name, last_name, phone, plan_id, expires_at)
                 VALUES (:id, :code, :club_id, :trainer_id, 'athlete', :created_by,
                         :first_name, :last_name, :phone, :plan_id, :expires_at)"
            )->execute([
                'id'         => Uuid::v4(),
                'code'       => $code,
                'club_id'    => $clubId,
                'trainer_id' => Validate::nullableString($data['trainer_id'] ?? null),
                'created_by' => $user['id'],
                'first_name' => Validate::nullableString($data['first_name'] ?? null),
                'last_name'  => Validate::nullableString($data['last_name'] ?? null),
                'phone'      => Validate::nullableString($data['phone'] ?? null),
                'plan_id'    => Validate::nullableString($data['plan_id'] ?? null),
                'expires_at' => date('Y-m-d H:i:s', strtotime('+' . self::INVITE_EXPIRES_DAYS . ' days')),
            ]);

            $pdo->commit();
            Response::ok(['code' => $code], 201);
        } catch (Throwable $e) {
            $pdo->rollBack();

            if ($e->getMessage() === 'capacity_full') {
                Response::error(409, 'capacity_full', 'The club has reached its plan member limit.');
                return;
            }
            if ($e->getMessage() === 'club_not_found') {
                Response::error(404, 'not_found', 'Club not found.');
                return;
            }
            throw $e;
        }
    }

    public static function revokeInvite(array $params): void
    {
        $user = Auth::requireUser();
        $pdo = Database::connection();

        $stmt = $pdo->prepare('SELECT club_id, created_by FROM invitations WHERE id = :id');
        $stmt->execute(['id' => $params['id']]);
        $invite = $stmt->fetch();

        if ($invite === false) {
            Response::error(404, 'not_found', 'Invitation not found.');
            return;
        }
        Acl::require(
            $invite['created_by'] === $user['id']
            || ($invite['club_id'] !== null && Acl::managesClub($user['id'], $invite['club_id']))
        );

        $pdo->prepare("UPDATE invitations SET status = 'revoked' WHERE id = :id AND status = 'pending'")
            ->execute(['id' => $params['id']]);

        Response::ok(['ok' => true]);
    }

    public static function updateMembership(array $params): void
    {
        $user = Auth::requireUser();
        $membership = self::membershipForManager($user, $params['id']);

        $data = Validate::body();
        $fields = [];
        $bind = ['id' => $params['id']];

        foreach (['plan_id', 'status', 'expires_at'] as $key) {
            if (array_key_exists($key, $data)) {
                $fields[] = "{$key} = :{$key}";
                $bind[$key] = Validate::nullableString($data[$key] === null ? null : (string) $data[$key]);
            }
        }

        if ($fields === []) {
            Response::error(400, 'no_fields', 'Nothing to update.');
            return;
        }

        Database::connection()
            ->prepare('UPDATE memberships SET ' . implode(', ', $fields) . ' WHERE id = :id')
            ->execute($bind);

        Response::ok(['ok' => true]);
    }

    public static function removeMember(array $params): void
    {
        $user = Auth::requireUser();
        $membership = self::membershipForManager($user, $params['id']);

        // A club owner removing their own membership would lock them out of
        // their own club (migration 0029 excludes it at the policy level).
        if ($membership['user_id'] === $user['id']) {
            Response::error(409, 'cannot_remove_self', 'You cannot remove your own membership.');
            return;
        }

        Database::connection()
            ->prepare('DELETE FROM memberships WHERE id = :id')
            ->execute(['id' => $params['id']]);

        Response::ok(['ok' => true]);
    }

    /** One member's whole file as the club may see it: the big aggregate read. */
    public static function memberProfile(array $params): void
    {
        $user = Auth::requireUser();
        $clubId = $params['id'];
        Acl::require(Acl::managesClub($user['id'], $clubId));

        $pdo = Database::connection();

        $stmt = $pdo->prepare(
            "SELECT m.id, m.user_id, m.plan_id, m.status, m.joined_at, m.expires_at,
                    p.first_name, p.last_name, p.phone, p.avatar_url,
                    cmp.name AS plan_name
             FROM memberships m
             JOIN profiles p ON p.id = m.user_id
             LEFT JOIN club_membership_plans cmp ON cmp.id = m.plan_id
             WHERE m.id = :id AND m.club_id = :club_id"
        );
        $stmt->execute(['id' => $params['membershipId'], 'club_id' => $clubId]);
        $member = $stmt->fetch();

        if ($member === false) {
            Response::error(404, 'not_found', 'Member not found in this club.');
            return;
        }

        $athleteId = $member['user_id'];

        $trainers = $pdo->prepare(
            "SELECT ta.trainer_id AS id, p.first_name, p.last_name
             FROM trainer_athletes ta
             JOIN profiles p ON p.id = ta.trainer_id
             WHERE ta.athlete_id = :athlete_id AND ta.club_id = :club_id AND ta.status = 'active'"
        );
        $trainers->execute(['athlete_id' => $athleteId, 'club_id' => $clubId]);

        $payments = $pdo->prepare(
            'SELECT id, amount, category, occurred_at, note
             FROM revenue_entries
             WHERE club_id = :club_id AND member_id = :member_id
             ORDER BY occurred_at DESC'
        );
        $payments->execute(['club_id' => $clubId, 'member_id' => $athleteId]);
        $paymentRows = Cast::rows($payments->fetchAll(), ['amount']);

        $plans = [];
        foreach (['workout', 'nutrition'] as $kind) {
            $table = Acl::planTable($kind);
            $stmt = $pdo->prepare(
                "SELECT id, title, status, updated_at FROM {$table}
                 WHERE athlete_id = :athlete_id AND is_template = 0 AND status <> 'draft'
                 ORDER BY updated_at DESC LIMIT 10"
            );
            $stmt->execute(['athlete_id' => $athleteId]);
            foreach ($stmt->fetchAll() as $plan) {
                $plans[] = $plan + ['kind' => $kind];
            }
        }
        usort($plans, static fn (array $a, array $b) => strcmp($b['updated_at'], $a['updated_at']));

        $measurements = $pdo->prepare(
            'SELECT id, weight_kg, height_cm, body_fat_percent, recorded_at
             FROM measurements WHERE athlete_id = :athlete_id
             ORDER BY recorded_at DESC LIMIT 10'
        );
        $measurements->execute(['athlete_id' => $athleteId]);

        $attendance = $pdo->prepare(
            'SELECT id, attended, class_date FROM class_attendance_logs
             WHERE club_id = :club_id AND member_id = :member_id
             ORDER BY class_date DESC LIMIT 20'
        );
        $attendance->execute(['club_id' => $clubId, 'member_id' => $athleteId]);
        $attendanceRows = Cast::rows($attendance->fetchAll(), [], [], ['attended']);

        $attended = count(array_filter($attendanceRows, static fn (array $r) => $r['attended']));

        Response::ok([
            'member'          => $member,
            'trainers'        => $trainers->fetchAll(),
            'payments'        => $paymentRows,
            'total_paid'      => array_sum(array_column($paymentRows, 'amount')),
            'plans'           => $plans,
            'measurements'    => Cast::rows($measurements->fetchAll(), ['weight_kg', 'height_cm', 'body_fat_percent']),
            'attendance'      => $attendanceRows,
            'attendance_rate' => $attendanceRows === []
                ? null
                : (int) round($attended / count($attendanceRows) * 100),
        ]);
    }

    /** @return array{active_members: int, pending_invites: int, capacity: int|null} */
    private static function capacitySnapshot(\PDO $pdo, string $clubId): array
    {
        $active = $pdo->prepare(
            "SELECT COUNT(*) AS c FROM memberships
             WHERE club_id = :club_id AND role = 'athlete' AND status = 'active'"
        );
        $active->execute(['club_id' => $clubId]);

        $pending = $pdo->prepare(
            "SELECT COUNT(*) AS c FROM invitations
             WHERE club_id = :club_id AND invited_role = 'athlete' AND status = 'pending' AND expires_at > NOW()"
        );
        $pending->execute(['club_id' => $clubId]);

        $club = $pdo->prepare('SELECT member_capacity FROM clubs WHERE id = :id');
        $club->execute(['id' => $clubId]);
        $capacity = $club->fetch()['member_capacity'] ?? null;

        return [
            'active_members'  => (int) $active->fetch()['c'],
            'pending_invites' => (int) $pending->fetch()['c'],
            'capacity'        => $capacity === null ? null : (int) $capacity,
        ];
    }

    /** Loads a membership and ends the request unless the caller manages its club. */
    private static function membershipForManager(array $user, string $membershipId): array
    {
        $stmt = Database::connection()->prepare('SELECT id, club_id, user_id FROM memberships WHERE id = :id');
        $stmt->execute(['id' => $membershipId]);
        $membership = $stmt->fetch();

        if ($membership === false) {
            Response::error(404, 'not_found', 'Membership not found.');
            exit;
        }
        Acl::require(Acl::managesClub($user['id'], $membership['club_id']));

        return $membership;
    }

    private static function pendingInvites(string $clubId): array
    {
        $stmt = Database::connection()->prepare(
            "SELECT i.id, i.code, i.first_name, i.last_name, i.phone, i.plan_id, i.trainer_id,
                    i.created_at, i.expires_at, cmp.name AS plan_name
             FROM invitations i
             LEFT JOIN club_membership_plans cmp ON cmp.id = i.plan_id
             WHERE i.club_id = :club_id AND i.invited_role = 'athlete'
               AND i.status = 'pending' AND i.expires_at > NOW()
             ORDER BY i.created_at DESC"
        );
        $stmt->execute(['club_id' => $clubId]);

        return $stmt->fetchAll();
    }
}
