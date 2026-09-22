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

/** The trainer's own athlete roster and the invites they hand out. */
final class AthleteController
{
    private const INVITE_EXPIRES_DAYS = 14;

    public static function list(): void
    {
        $user = Auth::requireUser();

        $stmt = Database::connection()->prepare(
            "SELECT ta.athlete_id AS id, ta.created_at,
                    p.first_name, p.last_name, p.birth_date, p.avatar_url,
                    (SELECT COUNT(*) FROM workout_assignments w
                      WHERE w.trainer_id = ta.trainer_id AND w.athlete_id = ta.athlete_id
                        AND w.is_template = 0 AND w.status <> 'draft') AS workout_plan_count,
                    (SELECT COUNT(*) FROM nutrition_assignments n
                      WHERE n.trainer_id = ta.trainer_id AND n.athlete_id = ta.athlete_id
                        AND n.is_template = 0 AND n.status <> 'draft') AS nutrition_plan_count
             FROM trainer_athletes ta
             JOIN profiles p ON p.id = ta.athlete_id
             WHERE ta.trainer_id = :trainer_id AND ta.status = 'active'
             ORDER BY ta.created_at DESC"
        );
        $stmt->execute(['trainer_id' => $user['id']]);

        Response::ok([
            'items' => Cast::rows($stmt->fetchAll(), [], ['workout_plan_count', 'nutrition_plan_count']),
        ]);
    }

    public static function get(array $params): void
    {
        $user = Auth::requireUser();

        $stmt = Database::connection()->prepare(
            "SELECT ta.created_at, ta.note,
                    p.id, p.first_name, p.last_name, p.birth_date, p.avatar_url, p.phone
             FROM trainer_athletes ta
             JOIN profiles p ON p.id = ta.athlete_id
             WHERE ta.trainer_id = :trainer_id AND ta.athlete_id = :athlete_id AND ta.status = 'active'"
        );
        $stmt->execute(['trainer_id' => $user['id'], 'athlete_id' => $params['id']]);
        $athlete = $stmt->fetch();

        if ($athlete === false) {
            Response::error(404, 'not_found', 'This athlete is not on your roster.');
            return;
        }

        Response::ok($athlete);
    }

    /** The private note is the trainer's own; only they may write it (0037). */
    public static function updateNote(array $params): void
    {
        $user = Auth::requireUser();
        $data = Validate::body();

        $stmt = Database::connection()->prepare(
            'UPDATE trainer_athletes SET note = :note WHERE trainer_id = :trainer_id AND athlete_id = :athlete_id'
        );
        $stmt->execute([
            'note'       => Validate::nullableString($data['note'] ?? null),
            'trainer_id' => $user['id'],
            'athlete_id' => $params['id'],
        ]);

        if ($stmt->rowCount() === 0) {
            Response::error(404, 'not_found', 'This athlete is not on your roster.');
            return;
        }

        Response::ok(['ok' => true]);
    }

    public static function remove(array $params): void
    {
        $user = Auth::requireUser();

        Database::connection()
            ->prepare('DELETE FROM trainer_athletes WHERE trainer_id = :trainer_id AND athlete_id = :athlete_id')
            ->execute(['trainer_id' => $user['id'], 'athlete_id' => $params['id']]);

        Response::ok(['ok' => true]);
    }

    public static function listInvites(): void
    {
        $user = Auth::requireUser();

        $stmt = Database::connection()->prepare(
            "SELECT i.id, i.code, i.first_name, i.last_name, i.phone, i.height_cm, i.weight_kg,
                    i.created_at, i.expires_at,
                    (SELECT COUNT(*) FROM workout_assignments w
                      WHERE w.invitation_id = i.id AND w.is_template = 0 AND w.status <> 'draft') AS workout_plan_count,
                    (SELECT COUNT(*) FROM nutrition_assignments n
                      WHERE n.invitation_id = i.id AND n.is_template = 0 AND n.status <> 'draft') AS nutrition_plan_count
             FROM invitations i
             WHERE i.created_by = :trainer_id AND i.invited_role = 'athlete' AND i.status = 'pending'
             ORDER BY i.created_at DESC"
        );
        $stmt->execute(['trainer_id' => $user['id']]);

        Response::ok([
            'items' => Cast::rows(
                $stmt->fetchAll(),
                ['height_cm', 'weight_kg'],
                ['workout_plan_count', 'nutrition_plan_count']
            ),
        ]);
    }

    /**
     * The invite carries the trainer's club so accept_athlete_invitation can
     * create the club membership alongside the coaching link; a trainer
     * working independently has none, which stays supported.
     */
    public static function createInvite(): void
    {
        $user = Auth::requireUser();
        $data = Validate::body();

        $club = self::trainerClub($user['id']);
        $code = Uuid::v4();

        Database::connection()->prepare(
            "INSERT INTO invitations (id, code, trainer_id, club_id, invited_role, created_by,
                                      first_name, last_name, phone, height_cm, weight_kg, expires_at)
             VALUES (:id, :code, :trainer_id, :club_id, 'athlete', :created_by,
                     :first_name, :last_name, :phone, :height_cm, :weight_kg, :expires_at)"
        )->execute([
            'id'         => Uuid::v4(),
            'code'       => $code,
            'trainer_id' => $user['id'],
            'club_id'    => $club['club_id'] ?? null,
            'created_by' => $user['id'],
            'first_name' => Validate::nullableString($data['first_name'] ?? null),
            'last_name'  => Validate::nullableString($data['last_name'] ?? null),
            'phone'      => Validate::nullableString($data['phone'] ?? null),
            'height_cm'  => $data['height_cm'] ?? null,
            'weight_kg'  => $data['weight_kg'] ?? null,
            'expires_at' => date('Y-m-d H:i:s', strtotime('+' . self::INVITE_EXPIRES_DAYS . ' days')),
        ]);

        Response::ok(['code' => $code], 201);
    }

    public static function revokeInvite(array $params): void
    {
        $user = Auth::requireUser();

        $stmt = Database::connection()->prepare(
            "UPDATE invitations SET status = 'revoked' WHERE id = :id AND created_by = :trainer_id AND status = 'pending'"
        );
        $stmt->execute(['id' => $params['id'], 'trainer_id' => $user['id']]);

        if ($stmt->rowCount() === 0) {
            Response::error(404, 'not_found', 'Pending invitation not found.');
            return;
        }

        Response::ok(['ok' => true]);
    }

    public static function club(): void
    {
        $user = Auth::requireUser();
        $club = self::trainerClub($user['id']);

        Response::ok(['club' => $club ?: null]);
    }

    private static function trainerClub(string $trainerId): ?array
    {
        $stmt = Database::connection()->prepare(
            "SELECT m.club_id, c.name
             FROM memberships m
             JOIN clubs c ON c.id = m.club_id
             WHERE m.user_id = :user_id AND m.role = 'trainer' AND m.status = 'active'
             ORDER BY m.joined_at ASC LIMIT 1"
        );
        $stmt->execute(['user_id' => $trainerId]);

        return $stmt->fetch() ?: null;
    }
}
