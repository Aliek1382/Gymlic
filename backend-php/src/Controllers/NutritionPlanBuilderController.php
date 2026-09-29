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

/**
 * The structured half of a nutrition plan: nutrition_plan_meals and
 * nutrition_plan_items. The nutrition twin of WorkoutPlanBuilderController
 * (meal <-> day, food <-> exercise), with one difference in how "structured"
 * is decided: nutrition_assignments has no builder_mode column, so a plan
 * counts as structured exactly when it has at least one meal row (see
 * PlanController::builderModeColumn). Nothing here touches description.
 *
 * Writes are trainer-only, same as PlanController::save. Reading the meals is
 * also open to whoever may view the plan (the athlete, a club manager, an
 * admin) — an athlete never sees a draft, or a plan an unpaid invoice locks.
 *
 * Calories and macros are deliberately not summed here: the client adds them
 * up from the per-unit figures this returns with each item.
 */
final class NutritionPlanBuilderController
{
    private const ITEM_MAX_AMOUNT = 99999.99;

    public static function listMeals(array $params): void
    {
        $user = Auth::requireUser();
        $assignment = self::assignmentOr404($params['id']);

        if ($assignment['trainer_id'] !== $user['id']) {
            Acl::require(Acl::canViewPlan($user, $assignment));
            if ($assignment['athlete_id'] === $user['id']) {
                self::requireReleasedToAthlete($assignment);
            }
        }

        Response::ok(['items' => self::mealsWithItems($params['id'])]);
    }

    public static function createMeal(array $params): void
    {
        $user = Auth::requireUser();
        $assignment = self::assignmentOr404($params['id']);
        Acl::require($assignment['trainer_id'] === $user['id']);

        $data = Validate::required(Validate::body(), ['meal_name']);
        $pdo = Database::connection();

        $stmt = $pdo->prepare(
            'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
             FROM nutrition_plan_meals WHERE assignment_id = :assignment_id'
        );
        $stmt->execute(['assignment_id' => $params['id']]);
        $sortOrder = (int) $stmt->fetch()['next_sort_order'];

        $id = Uuid::v4();
        $pdo->prepare(
            'INSERT INTO nutrition_plan_meals (id, assignment_id, meal_name, sort_order)
             VALUES (:id, :assignment_id, :meal_name, :sort_order)'
        )->execute([
            'id'            => $id,
            'assignment_id' => $params['id'],
            'meal_name'     => self::mealName($data['meal_name']),
            'sort_order'    => $sortOrder,
        ]);

        Response::ok(['id' => $id, 'sort_order' => $sortOrder], 201);
    }

    public static function updateMeal(array $params): void
    {
        $user = Auth::requireUser();
        $assignment = self::assignmentOr404($params['id']);
        Acl::require($assignment['trainer_id'] === $user['id']);
        $meal = self::mealOr404($params['id'], $params['mealId']);

        $data = Validate::body();
        $fields = [];
        $bind = ['id' => $meal['id']];

        if (array_key_exists('meal_name', $data)) {
            $fields[] = 'meal_name = :meal_name';
            $bind['meal_name'] = self::mealName($data['meal_name']);
        }
        if (array_key_exists('sort_order', $data)) {
            $fields[] = 'sort_order = :sort_order';
            $bind['sort_order'] = (int) $data['sort_order'];
        }

        if ($fields === []) {
            Response::error(400, 'no_fields', 'Nothing to update.');
            return;
        }

        Database::connection()
            ->prepare('UPDATE nutrition_plan_meals SET ' . implode(', ', $fields) . ' WHERE id = :id')
            ->execute($bind);

        Response::ok(['ok' => true]);
    }

    public static function deleteMeal(array $params): void
    {
        $user = Auth::requireUser();
        $assignment = self::assignmentOr404($params['id']);
        Acl::require($assignment['trainer_id'] === $user['id']);
        $meal = self::mealOr404($params['id'], $params['mealId']);

        Database::connection()
            ->prepare('DELETE FROM nutrition_plan_meals WHERE id = :id')
            ->execute(['id' => $meal['id']]);

        Response::ok(['ok' => true]);
    }

    public static function addItem(array $params): void
    {
        $user = Auth::requireUser();
        $assignment = self::assignmentOr404($params['id']);
        Acl::require($assignment['trainer_id'] === $user['id']);
        $meal = self::mealOr404($params['id'], $params['mealId']);

        $data = Validate::required(Validate::body(), ['food_id', 'amount']);
        $pdo = Database::connection();

        // Only the shared presets and this trainer's own foods are pickable;
        // checking here turns a foreign or stale id into a 404, not an FK 500.
        $food = $pdo->prepare('SELECT id FROM foods WHERE id = :id AND (created_by IS NULL OR created_by = :user_id)');
        $food->execute(['id' => (string) $data['food_id'], 'user_id' => $user['id']]);
        if ($food->fetch() === false) {
            Response::error(404, 'not_found', 'Food not found.');
            return;
        }

        $stmt = $pdo->prepare(
            'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
             FROM nutrition_plan_items WHERE meal_id = :meal_id'
        );
        $stmt->execute(['meal_id' => $meal['id']]);
        $sortOrder = (int) $stmt->fetch()['next_sort_order'];

        $id = Uuid::v4();
        $pdo->prepare(
            'INSERT INTO nutrition_plan_items (id, meal_id, food_id, amount, unit, note, sort_order)
             VALUES (:id, :meal_id, :food_id, :amount, :unit, :note, :sort_order)'
        )->execute([
            'id'         => $id,
            'meal_id'    => $meal['id'],
            'food_id'    => (string) $data['food_id'],
            'amount'     => self::amount($data['amount']),
            'unit'       => self::unit($data['unit'] ?? null),
            'note'       => self::note($data['note'] ?? null),
            'sort_order' => $sortOrder,
        ]);

        Response::ok(['id' => $id, 'sort_order' => $sortOrder], 201);
    }

    public static function updateItem(array $params): void
    {
        $user = Auth::requireUser();
        $assignment = self::assignmentOr404($params['id']);
        Acl::require($assignment['trainer_id'] === $user['id']);
        $meal = self::mealOr404($params['id'], $params['mealId']);
        $item = self::itemOr404($meal['id'], $params['itemId']);

        $data = Validate::body();
        $fields = [];
        $bind = ['id' => $item['id']];

        if (array_key_exists('amount', $data)) {
            $fields[] = 'amount = :amount';
            $bind['amount'] = self::amount($data['amount']);
        }
        if (array_key_exists('unit', $data)) {
            $fields[] = 'unit = :unit';
            $bind['unit'] = self::unit($data['unit']);
        }
        if (array_key_exists('note', $data)) {
            $fields[] = 'note = :note';
            $bind['note'] = self::note($data['note']);
        }
        if (array_key_exists('sort_order', $data)) {
            $fields[] = 'sort_order = :sort_order';
            $bind['sort_order'] = (int) $data['sort_order'];
        }

        if ($fields === []) {
            Response::error(400, 'no_fields', 'Nothing to update.');
            return;
        }

        Database::connection()
            ->prepare('UPDATE nutrition_plan_items SET ' . implode(', ', $fields) . ' WHERE id = :id')
            ->execute($bind);

        Response::ok(['ok' => true]);
    }

    public static function deleteItem(array $params): void
    {
        $user = Auth::requireUser();
        $assignment = self::assignmentOr404($params['id']);
        Acl::require($assignment['trainer_id'] === $user['id']);
        $meal = self::mealOr404($params['id'], $params['mealId']);
        $item = self::itemOr404($meal['id'], $params['itemId']);

        Database::connection()
            ->prepare('DELETE FROM nutrition_plan_items WHERE id = :id')
            ->execute(['id' => $item['id']]);

        Response::ok(['ok' => true]);
    }

    /** @return array<int, array<string, mixed>> */
    private static function mealsWithItems(string $assignmentId): array
    {
        $pdo = Database::connection();
        $stmt = $pdo->prepare(
            'SELECT id, meal_name, sort_order
             FROM nutrition_plan_meals
             WHERE assignment_id = :assignment_id
             ORDER BY sort_order ASC, created_at ASC'
        );
        $stmt->execute(['assignment_id' => $assignmentId]);
        $meals = Cast::rows($stmt->fetchAll(), [], ['sort_order']);

        if ($meals === []) {
            return [];
        }

        $mealIds = array_column($meals, 'id');
        $placeholders = implode(',', array_fill(0, count($mealIds), '?'));
        // calories_per_unit / protein_g / carbs_g / fat_g are per ONE
        // default_unit of the food; the client multiplies by amount.
        $stmt = $pdo->prepare(
            "SELECT i.id, i.meal_id, i.food_id, i.amount, i.unit, i.note, i.sort_order,
                    f.name AS food_name, f.name_en AS food_name_en, f.category, f.default_unit,
                    f.calories_per_unit, f.protein_g, f.carbs_g, f.fat_g
             FROM nutrition_plan_items i
             JOIN foods f ON f.id = i.food_id
             WHERE i.meal_id IN ({$placeholders})
             ORDER BY i.sort_order ASC, i.created_at ASC"
        );
        $stmt->execute($mealIds);
        $items = Cast::rows(
            $stmt->fetchAll(),
            ['amount', 'calories_per_unit', 'protein_g', 'carbs_g', 'fat_g'],
            ['sort_order']
        );

        $byMeal = [];
        foreach ($items as $item) {
            $byMeal[$item['meal_id']][] = $item;
        }
        foreach ($meals as &$meal) {
            $meal['items'] = $byMeal[$meal['id']] ?? [];
        }
        unset($meal);

        return $meals;
    }

    /**
     * What PlanController::get and listMine already enforce for the athlete:
     * no drafts, and no content while an unpaid invoice locks the plan.
     */
    private static function requireReleasedToAthlete(array $assignment): void
    {
        if ($assignment['status'] === 'draft') {
            Response::error(404, 'not_found', 'Plan not found.');
            exit;
        }

        $pending = InvoiceController::pendingByItem(InvoiceController::itemTypeFor('nutrition'), [$assignment['id']]);
        if (isset($pending[$assignment['id']])) {
            Response::error(403, 'plan_locked', 'This plan is locked until its invoice is paid.');
            exit;
        }
    }

    private static function mealName(mixed $value): string
    {
        $name = trim((string) $value);
        if ($name === '' || mb_strlen($name) > 100) {
            Response::error(400, 'invalid_meal_name', 'Meal name must be 1-100 characters.');
            exit;
        }
        return $name;
    }

    private static function amount(mixed $value): float
    {
        $amount = Validate::nullableNumber($value, 'amount', self::ITEM_MAX_AMOUNT);
        if ($amount === null || $amount <= 0) {
            Response::error(400, 'invalid_amount', 'amount must be greater than 0.');
            exit;
        }
        return $amount;
    }

    private static function unit(mixed $value): ?string
    {
        $unit = Validate::nullableString($value === null ? null : trim((string) $value));
        if ($unit !== null && mb_strlen($unit) > 50) {
            Response::error(400, 'invalid_unit', 'unit must be at most 50 characters.');
            exit;
        }
        return $unit;
    }

    private static function note(mixed $value): ?string
    {
        $note = Validate::nullableString($value === null ? null : trim((string) $value));
        if ($note !== null && mb_strlen($note) > 255) {
            Response::error(400, 'invalid_note', 'note must be at most 255 characters.');
            exit;
        }
        return $note;
    }

    private static function assignmentOr404(string $id): array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM nutrition_assignments WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $assignment = $stmt->fetch();

        if ($assignment === false) {
            Response::error(404, 'not_found', 'Plan not found.');
            exit;
        }

        return $assignment;
    }

    private static function mealOr404(string $assignmentId, string $mealId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT * FROM nutrition_plan_meals WHERE id = :id AND assignment_id = :assignment_id'
        );
        $stmt->execute(['id' => $mealId, 'assignment_id' => $assignmentId]);
        $meal = $stmt->fetch();

        if ($meal === false) {
            Response::error(404, 'not_found', 'Meal not found.');
            exit;
        }

        return $meal;
    }

    private static function itemOr404(string $mealId, string $itemId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT * FROM nutrition_plan_items WHERE id = :id AND meal_id = :meal_id'
        );
        $stmt->execute(['id' => $itemId, 'meal_id' => $mealId]);
        $item = $stmt->fetch();

        if ($item === false) {
            Response::error(404, 'not_found', 'Food entry not found.');
            exit;
        }

        return $item;
    }
}
