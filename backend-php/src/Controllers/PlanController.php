<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Acl;
use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Uuid;
use Gymlic\Validate;

/**
 * Workout and nutrition assignments share a shape, so one controller serves
 * both, keyed by the {kind} path segment.
 */
final class PlanController
{
    private const COLUMNS = 'id, title, description, status, assigned_at, updated_at';

    /** Plans a trainer wrote for one athlete, or pre-assigned to a pending invite. */
    public static function list(array $params): void
    {
        $user = Auth::requireUser();
        $table = self::table($params['kind']);

        $athleteId = $_GET['athlete_id'] ?? null;
        $invitationId = $_GET['invitation_id'] ?? null;

        if ($athleteId === null && $invitationId === null) {
            Response::error(400, 'missing_target', 'Pass athlete_id or invitation_id.');
            return;
        }

        $column = $athleteId !== null ? 'athlete_id' : 'invitation_id';
        $stmt = Database::connection()->prepare(
            "SELECT " . self::COLUMNS . " FROM {$table}
             WHERE trainer_id = :trainer_id AND {$column} = :target AND is_template = 0
             ORDER BY assigned_at DESC"
        );
        $stmt->execute(['trainer_id' => $user['id'], 'target' => $athleteId ?? $invitationId]);

        Response::ok(['items' => $stmt->fetchAll()]);
    }

    /** The athlete's own plans. Drafts stay hidden — the trainer hasn't sent them. */
    public static function listMine(array $params): void
    {
        $user = Auth::requireUser();
        $table = self::table($params['kind']);

        $stmt = Database::connection()->prepare(
            "SELECT " . self::COLUMNS . " FROM {$table}
             WHERE athlete_id = :athlete_id AND status <> 'draft' AND is_template = 0
             ORDER BY assigned_at DESC"
        );
        $stmt->execute(['athlete_id' => $user['id']]);

        Response::ok(['items' => $stmt->fetchAll()]);
    }

    public static function get(array $params): void
    {
        $user = Auth::requireUser();
        $plan = self::planOr404($params['kind'], $params['id']);
        Acl::require(Acl::canViewPlan($user, $plan));

        if ($plan['status'] === 'draft' && $plan['trainer_id'] !== $user['id']) {
            Response::error(404, 'not_found', 'Plan not found.');
            return;
        }

        Response::ok($plan);
    }

    public static function save(array $params): void
    {
        $user = Auth::requireUser();
        $kind = $params['kind'];
        $table = self::table($kind);
        $data = Validate::required(Validate::body(), ['title']);

        $status = (string) ($data['status'] ?? 'active');
        if (!in_array($status, ['active', 'draft'], true)) {
            Response::error(400, 'invalid_status', 'status must be active or draft.');
            return;
        }

        $pdo = Database::connection();

        if (!empty($data['id'])) {
            $existing = self::planOr404($kind, (string) $data['id']);
            Acl::require($existing['trainer_id'] === $user['id'], 'Only the plan\'s trainer can edit it.');

            $pdo->prepare(
                "UPDATE {$table} SET title = :title, description = :description, status = :status WHERE id = :id"
            )->execute([
                'title'       => (string) $data['title'],
                'description' => Validate::nullableString($data['description'] ?? null),
                'status'      => $status,
                'id'          => $data['id'],
            ]);

            // Sending a draft for the first time is what the athlete gets told about.
            if ($existing['status'] === 'draft' && $status === 'active' && $existing['athlete_id'] !== null) {
                self::notifyAssigned($user, $kind, $existing['athlete_id'], (string) $data['title']);
            }

            Response::ok(['id' => $data['id']]);
            return;
        }

        $athleteId = Validate::nullableString($data['athlete_id'] ?? null);
        $invitationId = Validate::nullableString($data['invitation_id'] ?? null);

        if ($athleteId === null && $invitationId === null) {
            Response::error(400, 'missing_target', 'Pass athlete_id or invitation_id.');
            return;
        }
        if ($athleteId !== null) {
            Acl::require(Acl::isTrainerOf($user['id'], $athleteId), 'This athlete is not on your roster.');
        }

        $clubId = null;
        if ($invitationId !== null || $athleteId !== null) {
            $clubId = self::trainerClubId($user['id']);
        }

        $id = Uuid::v4();
        $pdo->prepare(
            "INSERT INTO {$table} (id, club_id, trainer_id, athlete_id, invitation_id, title, description, status)
             VALUES (:id, :club_id, :trainer_id, :athlete_id, :invitation_id, :title, :description, :status)"
        )->execute([
            'id'            => $id,
            'club_id'       => $clubId,
            'trainer_id'    => $user['id'],
            'athlete_id'    => $athleteId,
            'invitation_id' => $invitationId,
            'title'         => (string) $data['title'],
            'description'   => Validate::nullableString($data['description'] ?? null),
            'status'        => $status,
        ]);

        if ($status !== 'draft' && $athleteId !== null) {
            self::notifyAssigned($user, $kind, $athleteId, (string) $data['title']);
        }

        Response::ok(['id' => $id], 201);
    }

    /** complete_workout_assignment / complete_nutrition_assignment (0015). */
    public static function complete(array $params): void
    {
        $user = Auth::requireUser();
        $kind = $params['kind'];
        $table = self::table($kind);
        $plan = self::planOr404($kind, $params['id']);

        Acl::require(
            $plan['trainer_id'] === $user['id'] || $plan['athlete_id'] === $user['id'],
            'Only this plan\'s trainer or athlete can complete it.'
        );

        $pdo = Database::connection();
        $stmt = $pdo->prepare("UPDATE {$table} SET status = 'completed' WHERE id = :id AND status = 'active'");
        $stmt->execute(['id' => $params['id']]);

        // notify_plan_completed (0020): tell the trainer, unless they did it.
        if ($stmt->rowCount() > 0 && $plan['trainer_id'] !== $user['id']) {
            AuthController::notify(
                $pdo,
                $plan['trainer_id'],
                $user['id'],
                $kind === 'nutrition' ? 'nutrition_completed' : 'workout_completed',
                'برنامه تکمیل شد',
                trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? '')) . ' برنامه «' . $plan['title'] . '» را تکمیل کرد.',
                '/athletes/' . $user['id']
            );
        }

        Response::ok(['ok' => true]);
    }

    public static function remove(array $params): void
    {
        $user = Auth::requireUser();
        $table = self::table($params['kind']);

        $stmt = Database::connection()->prepare(
            "DELETE FROM {$table} WHERE id = :id AND trainer_id = :trainer_id"
        );
        $stmt->execute(['id' => $params['id'], 'trainer_id' => $user['id']]);

        if ($stmt->rowCount() === 0) {
            Response::error(404, 'not_found', 'Plan not found.');
            return;
        }

        Response::ok(['ok' => true]);
    }

    public static function listTemplates(array $params): void
    {
        $user = Auth::requireUser();
        $table = self::table($params['kind']);

        $stmt = Database::connection()->prepare(
            "SELECT id, title, description, assigned_at FROM {$table}
             WHERE trainer_id = :trainer_id AND is_template = 1
             ORDER BY assigned_at DESC"
        );
        $stmt->execute(['trainer_id' => $user['id']]);

        Response::ok(['items' => $stmt->fetchAll()]);
    }

    public static function saveTemplate(array $params): void
    {
        $user = Auth::requireUser();
        $table = self::table($params['kind']);
        $data = Validate::required(Validate::body(), ['title']);

        $id = Uuid::v4();
        Database::connection()->prepare(
            "INSERT INTO {$table} (id, trainer_id, title, description, is_template)
             VALUES (:id, :trainer_id, :title, :description, 1)"
        )->execute([
            'id'          => $id,
            'trainer_id'  => $user['id'],
            'title'       => (string) $data['title'],
            'description' => Validate::nullableString($data['description'] ?? null),
        ]);

        Response::ok(['id' => $id], 201);
    }

    public static function deleteTemplate(array $params): void
    {
        $user = Auth::requireUser();
        $table = self::table($params['kind']);

        $stmt = Database::connection()->prepare(
            "DELETE FROM {$table} WHERE id = :id AND trainer_id = :trainer_id AND is_template = 1"
        );
        $stmt->execute(['id' => $params['id'], 'trainer_id' => $user['id']]);

        if ($stmt->rowCount() === 0) {
            Response::error(404, 'not_found', 'Template not found.');
            return;
        }

        Response::ok(['ok' => true]);
    }

    private static function table(string $kind): string
    {
        if (!in_array($kind, ['workout', 'nutrition'], true)) {
            Response::error(404, 'not_found', 'Unknown plan kind.');
            exit;
        }
        return Acl::planTable($kind);
    }

    private static function planOr404(string $kind, string $id): array
    {
        $table = self::table($kind);
        $stmt = Database::connection()->prepare("SELECT * FROM {$table} WHERE id = :id");
        $stmt->execute(['id' => $id]);
        $plan = $stmt->fetch();

        if ($plan === false) {
            Response::error(404, 'not_found', 'Plan not found.');
            exit;
        }

        return $plan;
    }

    private static function trainerClubId(string $trainerId): ?string
    {
        $stmt = Database::connection()->prepare(
            "SELECT club_id FROM memberships
             WHERE user_id = :user_id AND role = 'trainer' AND status = 'active'
             ORDER BY joined_at ASC LIMIT 1"
        );
        $stmt->execute(['user_id' => $trainerId]);
        $row = $stmt->fetch();

        return $row === false ? null : $row['club_id'];
    }

    /** notify_plan_assigned (0020). */
    private static function notifyAssigned(array $user, string $kind, string $athleteId, string $title): void
    {
        if ($athleteId === $user['id']) {
            return;
        }

        AuthController::notify(
            Database::connection(),
            $athleteId,
            $user['id'],
            $kind === 'nutrition' ? 'nutrition_assigned' : 'workout_assigned',
            $kind === 'nutrition' ? 'برنامه غذایی جدید' : 'برنامه تمرینی جدید',
            'برنامه «' . $title . '» برای شما ثبت شد.',
            $kind === 'nutrition' ? '/nutrition' : '/workouts'
        );
    }
}
