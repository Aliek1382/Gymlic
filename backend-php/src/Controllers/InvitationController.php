<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Uuid;
use Gymlic\Validate;
use PDO;
use Throwable;

/**
 * Ports accept_athlete_invitation / accept_club_invitation (SECURITY DEFINER RPCs,
 * supabase/migrations 0007..0037) as plain transactional PHP, since MySQL has no
 * equivalent of Postgres row-level security running server logic transparently.
 */
final class InvitationController
{
    public static function acceptAthlete(): void
    {
        $user = Auth::requireUser();
        $data = Validate::required(Validate::body(), ['code']);
        $code = (string) $data['code'];

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $stmt = $pdo->prepare(
                "SELECT * FROM invitations WHERE code = :code AND status = 'pending' AND expires_at > NOW() FOR UPDATE"
            );
            $stmt->execute(['code' => $code]);
            $invite = $stmt->fetch();

            if ($invite === false || $invite['invited_role'] !== 'athlete') {
                throw new \RuntimeException('invitation_not_found');
            }
            if ($invite['trainer_id'] === null && $invite['club_id'] === null) {
                throw new \RuntimeException('invitation_not_found');
            }
            if ($user['account_type'] !== null && $user['account_type'] !== 'athlete') {
                throw new \RuntimeException('account_type_mismatch');
            }

            // Set account type + names, copy phone only if the account doesn't have one yet.
            $updateProfile = $pdo->prepare(
                'UPDATE profiles SET account_type = :account_type,
                   first_name = COALESCE(first_name, :first_name),
                   last_name = COALESCE(last_name, :last_name),
                   phone = COALESCE(phone, :phone)
                 WHERE id = :id'
            );
            $updateProfile->execute([
                'account_type' => 'athlete',
                'first_name'   => $invite['first_name'],
                'last_name'    => $invite['last_name'],
                'phone'        => $invite['phone'],
                'id'           => $user['id'],
            ]);

            // trainer_athletes upsert
            if ($invite['trainer_id'] !== null) {
                $pdo->prepare(
                    'INSERT INTO trainer_athletes (id, trainer_id, athlete_id, club_id, status)
                     VALUES (:id, :trainer_id, :athlete_id, :club_id, "active")
                     ON DUPLICATE KEY UPDATE club_id = VALUES(club_id), status = "active"'
                )->execute([
                    'id'         => Uuid::v4(),
                    'trainer_id' => $invite['trainer_id'],
                    'athlete_id' => $user['id'],
                    'club_id'    => $invite['club_id'],
                ]);
            }

            // memberships upsert (club case) with expiry from the chosen plan
            if ($invite['club_id'] !== null) {
                $durationDays = 30;
                if ($invite['plan_id'] !== null) {
                    $planStmt = $pdo->prepare('SELECT duration_days FROM club_membership_plans WHERE id = :id');
                    $planStmt->execute(['id' => $invite['plan_id']]);
                    $plan = $planStmt->fetch();
                    if ($plan !== false) {
                        $durationDays = (int) $plan['duration_days'];
                    }
                }
                $expiresAt = date('Y-m-d', strtotime("+{$durationDays} days"));

                $pdo->prepare(
                    'INSERT INTO memberships (id, club_id, user_id, role, status, plan_tier, plan_id, expires_at)
                     VALUES (:id, :club_id, :user_id, "athlete", "active", :plan_tier, :plan_id, :expires_at)
                     ON DUPLICATE KEY UPDATE status = "active", plan_tier = VALUES(plan_tier),
                       plan_id = VALUES(plan_id), expires_at = VALUES(expires_at)'
                )->execute([
                    'id'         => Uuid::v4(),
                    'club_id'    => $invite['club_id'],
                    'user_id'    => $user['id'],
                    'plan_tier'  => $invite['plan_tier'] ?? 'basic',
                    'plan_id'    => $invite['plan_id'],
                    'expires_at' => $expiresAt,
                ]);

                AuthController::notify(
                    $pdo,
                    $invite['created_by'],
                    $user['id'],
                    'member_joined',
                    'عضو جدید',
                    trim(($invite['first_name'] ?? '') . ' ' . ($invite['last_name'] ?? '')) . ' به باشگاه پیوست.',
                    '/members'
                );
            }

            // Pre-set measurements carried on the invite.
            if ($invite['height_cm'] !== null || $invite['weight_kg'] !== null) {
                $pdo->prepare(
                    'INSERT INTO measurements (id, athlete_id, recorded_by, height_cm, weight_kg)
                     VALUES (:id, :athlete_id, :recorded_by, :height_cm, :weight_kg)'
                )->execute([
                    'id'          => Uuid::v4(),
                    'athlete_id'  => $user['id'],
                    'recorded_by' => $invite['created_by'],
                    'height_cm'   => $invite['height_cm'],
                    'weight_kg'   => $invite['weight_kg'],
                ]);
            }

            // Re-parent any plans pre-assigned to this invitation onto the new athlete.
            $pdo->prepare('UPDATE workout_assignments SET athlete_id = :aid WHERE invitation_id = :inv')
                ->execute(['aid' => $user['id'], 'inv' => $invite['id']]);
            $pdo->prepare('UPDATE nutrition_assignments SET athlete_id = :aid WHERE invitation_id = :inv')
                ->execute(['aid' => $user['id'], 'inv' => $invite['id']]);

            $pdo->prepare(
                "UPDATE invitations SET status = 'accepted', accepted_by = :uid, accepted_at = NOW() WHERE id = :id"
            )->execute(['uid' => $user['id'], 'id' => $invite['id']]);

            if ($invite['created_by'] !== $user['id']) {
                AuthController::notify(
                    $pdo,
                    $invite['created_by'],
                    $user['id'],
                    'invitation_accepted',
                    'دعوت پذیرفته شد',
                    trim(($invite['first_name'] ?? '') . ' ' . ($invite['last_name'] ?? '')) . ' دعوت شما را پذیرفت.',
                    null
                );
            }

            $pdo->commit();
            Response::ok(['ok' => true]);
        } catch (Throwable $e) {
            $pdo->rollBack();
            self::respondForException($e);
        }
    }

    public static function acceptClub(): void
    {
        $user = Auth::requireUser();
        $data = Validate::required(Validate::body(), ['code']);
        $code = (string) $data['code'];

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $stmt = $pdo->prepare(
                "SELECT * FROM invitations WHERE code = :code AND status = 'pending' AND expires_at > NOW() FOR UPDATE"
            );
            $stmt->execute(['code' => $code]);
            $invite = $stmt->fetch();

            if ($invite === false || $invite['invited_role'] !== 'trainer' || $invite['club_id'] === null) {
                throw new \RuntimeException('invitation_not_found');
            }
            if ($user['account_type'] !== null && $user['account_type'] !== 'trainer') {
                throw new \RuntimeException('account_type_mismatch');
            }

            $already = $pdo->prepare('SELECT id FROM memberships WHERE club_id = :club_id AND user_id = :user_id');
            $already->execute(['club_id' => $invite['club_id'], 'user_id' => $user['id']]);
            if ($already->fetch() !== false) {
                throw new \RuntimeException('already_member');
            }

            $pdo->prepare(
                'UPDATE profiles SET account_type = :account_type,
                   first_name = COALESCE(first_name, :first_name),
                   last_name = COALESCE(last_name, :last_name),
                   phone = COALESCE(phone, :phone)
                 WHERE id = :id'
            )->execute([
                'account_type' => 'trainer',
                'first_name'   => $invite['first_name'],
                'last_name'    => $invite['last_name'],
                'phone'        => $invite['phone'],
                'id'           => $user['id'],
            ]);

            $pdo->prepare(
                'INSERT INTO memberships (id, club_id, user_id, role, status)
                 VALUES (:id, :club_id, :user_id, "trainer", "active")'
            )->execute([
                'id'      => Uuid::v4(),
                'club_id' => $invite['club_id'],
                'user_id' => $user['id'],
            ]);

            // Re-parent the trainer's pre-existing (clubless) athletes onto this club,
            // and mirror them into memberships too.
            $priorAthletes = $pdo->prepare(
                'SELECT athlete_id FROM trainer_athletes WHERE trainer_id = :tid AND club_id IS NULL'
            );
            $priorAthletes->execute(['tid' => $user['id']]);
            $athleteIds = array_column($priorAthletes->fetchAll(), 'athlete_id');

            if ($athleteIds !== []) {
                $pdo->prepare(
                    'UPDATE trainer_athletes SET club_id = :club_id WHERE trainer_id = :tid AND club_id IS NULL'
                )->execute(['club_id' => $invite['club_id'], 'tid' => $user['id']]);

                $mirror = $pdo->prepare(
                    'INSERT INTO memberships (id, club_id, user_id, role, status)
                     VALUES (:id, :club_id, :user_id, "athlete", "active")
                     ON DUPLICATE KEY UPDATE status = "active"'
                );
                foreach ($athleteIds as $athleteId) {
                    $mirror->execute([
                        'id'      => Uuid::v4(),
                        'club_id' => $invite['club_id'],
                        'user_id' => $athleteId,
                    ]);
                }
            }

            $pdo->prepare(
                "UPDATE invitations SET status = 'accepted', accepted_by = :uid, accepted_at = NOW() WHERE id = :id"
            )->execute(['uid' => $user['id'], 'id' => $invite['id']]);

            if ($invite['created_by'] !== $user['id']) {
                AuthController::notify(
                    $pdo,
                    $invite['created_by'],
                    $user['id'],
                    'invitation_accepted',
                    'دعوت پذیرفته شد',
                    trim(($invite['first_name'] ?? '') . ' ' . ($invite['last_name'] ?? '')) . ' دعوت شما را پذیرفت.',
                    null
                );
            }

            $pdo->commit();
            Response::ok(['ok' => true]);
        } catch (Throwable $e) {
            $pdo->rollBack();
            self::respondForException($e);
        }
    }

    private static function respondForException(Throwable $e): void
    {
        $map = [
            'invitation_not_found'  => [404, 'This invitation is invalid, expired, or already used.'],
            'account_type_mismatch' => [409, 'This account already has a different role.'],
            'already_member'        => [409, 'You are already a member of this club.'],
        ];
        [$status, $message] = $map[$e->getMessage()] ?? [500, 'Could not accept the invitation.'];
        Response::error($status, $e->getMessage() ?: 'server_error', $message);
    }
}
