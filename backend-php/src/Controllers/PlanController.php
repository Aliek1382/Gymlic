<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Acl;
use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\PointsService;
use Gymlic\Response;
use Gymlic\Uuid;
use Gymlic\Validate;
use Gymlic\Templates;
use Gymlic\ContentLibrary;

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
            "SELECT " . self::columns($params['kind']) . " FROM {$table}
             WHERE trainer_id = :trainer_id AND {$column} = :target AND is_template = 0
             ORDER BY assigned_at DESC"
        );
        $stmt->execute(['trainer_id' => $user['id'], 'target' => $athleteId ?? $invitationId]);

        // The trainer always sees the full plan; a pending invoice only adds
        // the locked flag so their screen can badge it.
        $items = $stmt->fetchAll();
        $pending = InvoiceController::pendingByItem(InvoiceController::itemTypeFor($params['kind']), array_column($items, 'id'));
        foreach ($items as &$item) {
            if (isset($pending[$item['id']])) {
                $item['locked'] = true;
                $item['invoice'] = $pending[$item['id']];
            }
        }
        unset($item);

        Response::ok(['items' => $items]);
    }

    /** The athlete's own plans. Drafts stay hidden — the trainer hasn't sent them. */
    public static function listMine(array $params): void
    {
        $user = Auth::requireUser();
        $table = self::table($params['kind']);

        $stmt = Database::connection()->prepare(
            "SELECT " . self::columns($params['kind']) . " FROM {$table}
             WHERE athlete_id = :athlete_id AND status <> 'draft' AND is_template = 0
             ORDER BY assigned_at DESC"
        );
        $stmt->execute(['athlete_id' => $user['id']]);

        $items = self::lockForAthlete($params['kind'], $stmt->fetchAll());

        Response::ok(['items' => $items]);
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

        // Only the plan's own athlete is locked out — its trainer, a club
        // manager and platform admins always see the whole plan.
        if ($plan['athlete_id'] === $user['id'] && $plan['trainer_id'] !== $user['id']) {
            [$plan] = self::lockForAthlete($params['kind'], [$plan]);
        }

        Response::ok($plan);
    }

    /**
     * Strips the content of any plan with a pending invoice and says why, so
     * the athlete sees the amount instead. A plan with no invoice, or a paid or
     * cancelled one, passes through untouched. Shared with the athlete dashboard.
     *
     * @param array<int, array<string, mixed>> $plans rows with at least `id`
     * @return array<int, array<string, mixed>>
     */
    public static function lockForAthlete(string $kind, array $plans): array
    {
        $pending = InvoiceController::pendingByItem(InvoiceController::itemTypeFor($kind), array_column($plans, 'id'));
        if ($pending === []) {
            return $plans;
        }

        foreach ($plans as &$plan) {
            if (!isset($pending[$plan['id']])) {
                continue;
            }
            // builder_mode is dropped too: 'structured' would make the client
            // fetch days it must not show.
            unset($plan['description'], $plan['builder_mode']);
            $plan['locked'] = true;
            $plan['invoice'] = $pending[$plan['id']];
        }
        unset($plan);

        return $plans;
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

        // Only brand-new plans earn points; the edit and draft-to-active
        // branch above returns before reaching here.
        PointsService::award($user['id'], $kind === 'nutrition' ? 'nutrition_plan_created' : 'workout_plan_created');

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
            Templates::notify(
                $pdo,
                'plan_completed',
                $plan['trainer_id'],
                $user['id'],
                $kind === 'nutrition' ? 'nutrition_completed' : 'workout_completed',
                ['name' => trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? '')), 'title' => $plan['title']],
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
            "SELECT id, title, description, assigned_at, " . self::builderModeColumn($params['kind']) . " FROM {$table}
             WHERE trainer_id = :trainer_id AND is_template = 1" . ContentLibrary::ownOnly() . "
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

        // Optional: the plan the template is made from. Without it (or when
        // that plan is plain text) only title/description are stored.
        $sourceId = Validate::nullableString($data['source_id'] ?? null);
        if ($sourceId !== null) {
            $source = self::planOr404($params['kind'], $sourceId);
            Acl::require($source['trainer_id'] === $user['id'], 'Only the plan\'s trainer can save it as a template.');
        }

        $pdo = Database::connection();
        $id = Uuid::v4();
        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                "INSERT INTO {$table} (id, trainer_id, title, description, is_template)
                 VALUES (:id, :trainer_id, :title, :description, 1)"
            )->execute([
                'id'          => $id,
                'trainer_id'  => $user['id'],
                'title'       => (string) $data['title'],
                'description' => Validate::nullableString($data['description'] ?? null),
            ]);

            if ($sourceId !== null) {
                self::copyStructure($sourceId, $id, $params['kind']);
            }
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        Response::ok(['id' => $id], 201);
    }

    /**
     * Starts a new draft plan for an athlete/invitation from one of the
     * trainer's templates, copying the template's structure (if any) so the
     * draft is fully independent of it.
     */
    public static function applyTemplate(array $params): void
    {
        $user = Auth::requireUser();
        $kind = $params['kind'];
        $table = self::table($kind);
        $data = Validate::body();

        $template = self::planOr404($kind, $params['id']);
        // Public templates are copied from the content library first, never applied directly.
        if ((int) $template['is_template'] !== 1 || $template['trainer_id'] !== $user['id'] || !empty($template['is_public'])) {
            Response::error(404, 'not_found', 'Template not found.');
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

        $title = trim((string) ($data['title'] ?? ''));
        if ($title === '') {
            $title = (string) $template['title'];
        }

        $pdo = Database::connection();
        $clubId = self::trainerClubId($user['id']);
        $id = Uuid::v4();

        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                "INSERT INTO {$table} (id, club_id, trainer_id, athlete_id, invitation_id, title, description, status)
                 VALUES (:id, :club_id, :trainer_id, :athlete_id, :invitation_id, :title, :description, 'draft')"
            )->execute([
                'id'            => $id,
                'club_id'       => $clubId,
                'trainer_id'    => $user['id'],
                'athlete_id'    => $athleteId,
                'invitation_id' => $invitationId,
                'title'         => $title,
                'description'   => $template['description'],
            ]);

            self::copyStructure($params['id'], $id, $kind);
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $created = self::planOr404($kind, $id);
        Response::ok([
            'id'           => $id,
            'title'        => $created['title'],
            'description'  => $created['description'],
            'builder_mode' => $created['builder_mode'],
        ], 201);
    }

    /**
     * Deep-copies the structured rows (workout days + exercises, or nutrition
     * meals + items) of one assignment under another, with fresh ids, so the
     * two never share a row. A text plan has no rows and this is a no-op.
     * Shared by saveTemplate (plan -> template) and applyTemplate
     * (template -> plan). Callers wrap it in a transaction.
     */
    public static function copyStructure(string $fromAssignmentId, string $toAssignmentId, string $kind): void
    {
        $pdo = Database::connection();

        if ($kind === 'workout') {
            $stmt = $pdo->prepare(
                'SELECT id, week_number, day_number, day_name, sort_order FROM workout_plan_days
                 WHERE assignment_id = :assignment_id ORDER BY sort_order ASC'
            );
            $stmt->execute(['assignment_id' => $fromAssignmentId]);
            $days = $stmt->fetchAll();
            if ($days === []) {
                return;
            }

            $insert = $pdo->prepare(
                'INSERT INTO workout_plan_days (id, assignment_id, week_number, day_number, day_name, sort_order)
                 VALUES (:id, :assignment_id, :week_number, :day_number, :day_name, :sort_order)'
            );
            foreach ($days as $day) {
                $newDayId = Uuid::v4();
                $insert->execute([
                    'id'            => $newDayId,
                    'assignment_id' => $toAssignmentId,
                    'week_number'   => $day['week_number'],
                    'day_number'    => $day['day_number'],
                    'day_name'      => $day['day_name'],
                    'sort_order'    => $day['sort_order'],
                ]);
                WorkoutPlanBuilderController::copyExercisesToDay($day['id'], $newDayId);
            }

            $pdo->prepare("UPDATE workout_assignments SET builder_mode = 'structured' WHERE id = :id")
                ->execute(['id' => $toAssignmentId]);
            return;
        }

        $stmt = $pdo->prepare(
            'SELECT id, meal_name, sort_order FROM nutrition_plan_meals
             WHERE assignment_id = :assignment_id ORDER BY sort_order ASC'
        );
        $stmt->execute(['assignment_id' => $fromAssignmentId]);
        $insertMeal = $pdo->prepare(
            'INSERT INTO nutrition_plan_meals (id, assignment_id, meal_name, sort_order)
             VALUES (:id, :assignment_id, :meal_name, :sort_order)'
        );
        $selectItems = $pdo->prepare(
            'SELECT food_id, amount, unit, note, sort_order FROM nutrition_plan_items
             WHERE meal_id = :meal_id ORDER BY sort_order ASC'
        );
        $insertItem = $pdo->prepare(
            'INSERT INTO nutrition_plan_items (id, meal_id, food_id, amount, unit, note, sort_order)
             VALUES (:id, :meal_id, :food_id, :amount, :unit, :note, :sort_order)'
        );
        foreach ($stmt->fetchAll() as $meal) {
            $newMealId = Uuid::v4();
            $insertMeal->execute([
                'id'            => $newMealId,
                'assignment_id' => $toAssignmentId,
                'meal_name'     => $meal['meal_name'],
                'sort_order'    => $meal['sort_order'],
            ]);
            $selectItems->execute(['meal_id' => $meal['id']]);
            foreach ($selectItems->fetchAll() as $item) {
                $insertItem->execute([
                    'id'         => Uuid::v4(),
                    'meal_id'    => $newMealId,
                    'food_id'    => $item['food_id'],
                    'amount'     => $item['amount'],
                    'unit'       => $item['unit'],
                    'note'       => $item['note'],
                    'sort_order' => $item['sort_order'],
                ]);
            }
        }
    }

    public static function deleteTemplate(array $params): void
    {
        $user = Auth::requireUser();
        $table = self::table($params['kind']);

        $stmt = Database::connection()->prepare(
            "DELETE FROM {$table} WHERE id = :id AND trainer_id = :trainer_id AND is_template = 1" . ContentLibrary::ownOnly()
        );
        $stmt->execute(['id' => $params['id'], 'trainer_id' => $user['id']]);

        if ($stmt->rowCount() === 0) {
            Response::error(404, 'not_found', 'Template not found.');
            return;
        }

        Response::ok(['ok' => true]);
    }

    private static function columns(string $kind): string
    {
        return self::COLUMNS . ', ' . self::builderModeColumn($kind);
    }

    /**
     * The builder_mode select expression for a plan kind. workout_assignments
     * stores it; nutrition_assignments has no such column, so a nutrition plan
     * counts as 'structured' exactly when it has meal rows and 'text' when it
     * has none. Unqualified table name on purpose: callers select FROM the bare
     * table (no alias), and the correlated subquery needs that name.
     */
    public static function builderModeColumn(string $kind): string
    {
        if ($kind === 'workout') {
            return 'builder_mode';
        }
        return "IF(EXISTS(SELECT 1 FROM nutrition_plan_meals m WHERE m.assignment_id = nutrition_assignments.id), 'structured', 'text') AS builder_mode";
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
        // Workout rows already carry builder_mode; a nutrition row gets it derived.
        $extra = $kind === 'nutrition' ? ', ' . self::builderModeColumn($kind) : '';
        $stmt = Database::connection()->prepare("SELECT *{$extra} FROM {$table} WHERE id = :id");
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

        Templates::notify(
            Database::connection(),
            $kind === 'nutrition' ? 'nutrition_assigned' : 'workout_assigned',
            $athleteId,
            $user['id'],
            $kind === 'nutrition' ? 'nutrition_assigned' : 'workout_assigned',
            ['title' => $title],
            $kind === 'nutrition' ? '/nutrition' : '/workouts'
        );
    }
}
