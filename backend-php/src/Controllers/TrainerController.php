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

/** Club-side trainer roster. The trainer's own athlete roster is AthleteController. */
final class TrainerController
{
    private const INVITE_EXPIRES_DAYS = 14;

    public static function list(array $params): void
    {
        $user = Auth::requireUser();
        $clubId = $params['id'];
        Acl::require(Acl::managesClub($user['id'], $clubId));

        // The athlete count joins in as an aggregate rather than the second
        // query plus client-side tallying the browser did.
        $stmt = Database::connection()->prepare(
            "SELECT m.id, m.user_id, m.status, m.joined_at,
                    p.first_name, p.last_name, p.phone, p.avatar_url,
                    COUNT(ta.id) AS athlete_count
             FROM memberships m
             JOIN profiles p ON p.id = m.user_id
             LEFT JOIN trainer_athletes ta
               ON ta.trainer_id = m.user_id AND ta.club_id = m.club_id AND ta.status = 'active'
             WHERE m.club_id = :club_id AND m.role = 'trainer'
             GROUP BY m.id, m.user_id, m.status, m.joined_at,
                      p.first_name, p.last_name, p.phone, p.avatar_url
             ORDER BY m.joined_at DESC"
        );
        $stmt->execute(['club_id' => $clubId]);

        Response::ok(['items' => Cast::rows($stmt->fetchAll(), [], ['athlete_count'])]);
    }

    public static function listInvites(array $params): void
    {
        $user = Auth::requireUser();
        $clubId = $params['id'];
        Acl::require(Acl::managesClub($user['id'], $clubId));

        $stmt = Database::connection()->prepare(
            "SELECT id, code, first_name, last_name, phone, created_at, expires_at
             FROM invitations
             WHERE club_id = :club_id AND invited_role = 'trainer'
               AND status = 'pending' AND expires_at > NOW()
             ORDER BY created_at DESC"
        );
        $stmt->execute(['club_id' => $clubId]);

        Response::ok(['items' => $stmt->fetchAll()]);
    }

    public static function createInvite(array $params): void
    {
        $user = Auth::requireUser();
        $clubId = $params['id'];
        Acl::require(Acl::managesClub($user['id'], $clubId));

        $data = Validate::body();
        $code = Uuid::v4();

        Database::connection()->prepare(
            "INSERT INTO invitations (id, code, club_id, invited_role, created_by,
                                      first_name, last_name, phone, expires_at)
             VALUES (:id, :code, :club_id, 'trainer', :created_by,
                     :first_name, :last_name, :phone, :expires_at)"
        )->execute([
            'id'         => Uuid::v4(),
            'code'       => $code,
            'club_id'    => $clubId,
            'created_by' => $user['id'],
            'first_name' => Validate::nullableString($data['first_name'] ?? null),
            'last_name'  => Validate::nullableString($data['last_name'] ?? null),
            'phone'      => Validate::nullableString($data['phone'] ?? null),
            'expires_at' => date('Y-m-d H:i:s', strtotime('+' . self::INVITE_EXPIRES_DAYS . ' days')),
        ]);

        Response::ok(['code' => $code], 201);
    }

    /** Activate or suspend a trainer's membership. */
    public static function updateMembership(array $params): void
    {
        $user = Auth::requireUser();
        $data = Validate::required(Validate::body(), ['status']);
        $status = (string) $data['status'];

        if (!in_array($status, ['active', 'pending', 'suspended'], true)) {
            Response::error(400, 'invalid_status', 'status must be active, pending or suspended.');
            return;
        }

        $pdo = Database::connection();
        $stmt = $pdo->prepare("SELECT club_id FROM memberships WHERE id = :id AND role = 'trainer'");
        $stmt->execute(['id' => $params['id']]);
        $membership = $stmt->fetch();

        if ($membership === false) {
            Response::error(404, 'not_found', 'Trainer membership not found.');
            return;
        }
        Acl::require(Acl::managesClub($user['id'], $membership['club_id']));

        $pdo->prepare('UPDATE memberships SET status = :status WHERE id = :id')
            ->execute(['status' => $status, 'id' => $params['id']]);

        Response::ok(['ok' => true]);
    }

    public static function remove(array $params): void
    {
        $user = Auth::requireUser();

        $pdo = Database::connection();
        $stmt = $pdo->prepare("SELECT club_id, user_id FROM memberships WHERE id = :id AND role = 'trainer'");
        $stmt->execute(['id' => $params['id']]);
        $membership = $stmt->fetch();

        if ($membership === false) {
            Response::error(404, 'not_found', 'Trainer membership not found.');
            return;
        }
        Acl::require(Acl::managesClub($user['id'], $membership['club_id']));

        $pdo->beginTransaction();
        // Their athletes stay in the club; only the club link on the coaching
        // relation is cleared, matching what removing a trainer means here.
        $pdo->prepare('UPDATE trainer_athletes SET club_id = NULL WHERE trainer_id = :trainer_id AND club_id = :club_id')
            ->execute(['trainer_id' => $membership['user_id'], 'club_id' => $membership['club_id']]);
        $pdo->prepare('DELETE FROM memberships WHERE id = :id')->execute(['id' => $params['id']]);
        $pdo->commit();

        Response::ok(['ok' => true]);
    }
}
