<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Acl;
use Gymlic\Auth;
use Gymlic\Cast;
use Gymlic\Database;
use Gymlic\Limits;
use Gymlic\Response;
use Gymlic\Uuid;
use Gymlic\Validate;

/**
 * The structured half of a workout plan: workout_plan_days and
 * workout_plan_exercises, sitting behind workout_assignments.builder_mode.
 * A plan is either fully text (description, no rows here) or fully
 * structured (rows here, description left as whatever it was) — never both,
 * so every write here flips builder_mode to 'structured' and never touches
 * description. Every write is trainer-only, same as PlanController::save;
 * listing the days is also open to whoever may view the plan — the athlete
 * above all, whose own screen reads its program from here — except that an
 * athlete never gets a draft or a plan an unpaid invoice locks.
 */
final class WorkoutPlanBuilderController
{
    private const EXERCISE_FIELDS = ['sets', 'reps', 'weight_kg', 'rest_seconds', 'note', 'technique_id', 'sort_order'];

    public static function listDays(array $params): void
    {
        $user = Auth::requireUser();
        $assignment = self::assignmentOr404($params['id']);

        if ($assignment['trainer_id'] !== $user['id']) {
            Acl::require(Acl::canViewPlan($user, $assignment));
            if ($assignment['athlete_id'] === $user['id']) {
                self::requireReleasedToAthlete($assignment);
            }
        }

        Response::ok(['items' => self::daysWithExercises($params['id'])]);
    }

    public static function createDay(array $params): void
    {
        $user = Auth::requireUser();
        $assignment = self::assignmentOr404($params['id']);
        Acl::require($assignment['trainer_id'] === $user['id']);
        Limits::requireWritable($user['id'], $assignment['athlete_id'] ?? null);

        $data = Validate::required(Validate::body(), ['day_number']);
        $pdo = Database::connection();

        $stmt = $pdo->prepare(
            'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
             FROM workout_plan_days WHERE assignment_id = :assignment_id'
        );
        $stmt->execute(['assignment_id' => $params['id']]);
        $sortOrder = (int) $stmt->fetch()['next_sort_order'];

        $id = Uuid::v4();
        $pdo->prepare(
            'INSERT INTO workout_plan_days (id, assignment_id, week_number, day_number, day_name, sort_order)
             VALUES (:id, :assignment_id, :week_number, :day_number, :day_name, :sort_order)'
        )->execute([
            'id'            => $id,
            'assignment_id' => $params['id'],
            'week_number'   => (int) ($data['week_number'] ?? 1),
            'day_number'    => (int) $data['day_number'],
            'day_name'      => Validate::nullableString($data['day_name'] ?? null),
            'sort_order'    => $sortOrder,
        ]);

        self::markStructured($pdo, $params['id']);

        Response::ok(['id' => $id], 201);
    }

    public static function updateDay(array $params): void
    {
        $user = Auth::requireUser();
        $assignment = self::assignmentOr404($params['id']);
        Acl::require($assignment['trainer_id'] === $user['id']);
        Limits::requireWritable($user['id'], $assignment['athlete_id'] ?? null);
        $day = self::dayOr404($params['id'], $params['dayId']);

        $data = Validate::body();
        $fields = [];
        $bind = ['id' => $day['id']];

        foreach (['day_name' => true, 'day_number' => false, 'week_number' => false] as $key => $nullable) {
            if (!array_key_exists($key, $data)) {
                continue;
            }
            $fields[] = "{$key} = :{$key}";
            $bind[$key] = $nullable ? Validate::nullableString($data[$key]) : (int) $data[$key];
        }

        if ($fields === []) {
            Response::error(400, 'no_fields', 'Nothing to update.');
            return;
        }

        Database::connection()
            ->prepare('UPDATE workout_plan_days SET ' . implode(', ', $fields) . ' WHERE id = :id')
            ->execute($bind);

        Response::ok(['ok' => true]);
    }

    public static function deleteDay(array $params): void
    {
        $user = Auth::requireUser();
        $assignment = self::assignmentOr404($params['id']);
        Acl::require($assignment['trainer_id'] === $user['id']);
        Limits::requireWritable($user['id'], $assignment['athlete_id'] ?? null);
        $day = self::dayOr404($params['id'], $params['dayId']);

        Database::connection()
            ->prepare('DELETE FROM workout_plan_days WHERE id = :id')
            ->execute(['id' => $day['id']]);

        Response::ok(['ok' => true]);
    }

    public static function addExercise(array $params): void
    {
        $user = Auth::requireUser();
        $assignment = self::assignmentOr404($params['id']);
        Acl::require($assignment['trainer_id'] === $user['id']);
        Limits::requireWritable($user['id'], $assignment['athlete_id'] ?? null);
        $day = self::dayOr404($params['id'], $params['dayId']);

        $data = Validate::required(Validate::body(), ['exercise_id']);
        $techniqueId = self::techniqueIdOr404($data['technique_id'] ?? null, $user['id']);
        $pdo = Database::connection();

        $stmt = $pdo->prepare(
            'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
             FROM workout_plan_exercises WHERE day_id = :day_id'
        );
        $stmt->execute(['day_id' => $day['id']]);
        $sortOrder = (int) $stmt->fetch()['next_sort_order'];

        $id = Uuid::v4();
        $pdo->prepare(
            'INSERT INTO workout_plan_exercises (id, day_id, exercise_id, sets, reps, weight_kg, rest_seconds, note, technique_id, sort_order)
             VALUES (:id, :day_id, :exercise_id, :sets, :reps, :weight_kg, :rest_seconds, :note, :technique_id, :sort_order)'
        )->execute([
            'id'           => $id,
            'day_id'       => $day['id'],
            'exercise_id'  => (string) $data['exercise_id'],
            'sets'         => isset($data['sets']) ? (int) $data['sets'] : null,
            'reps'         => Validate::nullableString($data['reps'] ?? null),
            'weight_kg'    => $data['weight_kg'] ?? null,
            'rest_seconds' => isset($data['rest_seconds']) ? (int) $data['rest_seconds'] : null,
            'note'         => Validate::nullableString($data['note'] ?? null),
            'technique_id' => $techniqueId,
            'sort_order'   => $sortOrder,
        ]);

        self::markStructured($pdo, $params['id']);

        Response::ok(['id' => $id], 201);
    }

    public static function updateExercise(array $params): void
    {
        $user = Auth::requireUser();
        $assignment = self::assignmentOr404($params['id']);
        Acl::require($assignment['trainer_id'] === $user['id']);
        Limits::requireWritable($user['id'], $assignment['athlete_id'] ?? null);
        $day = self::dayOr404($params['id'], $params['dayId']);
        $exercise = self::exerciseOr404($day['id'], $params['exId']);

        $data = Validate::body();
        $fields = [];
        $bind = ['id' => $exercise['id']];

        foreach (self::EXERCISE_FIELDS as $key) {
            if (!array_key_exists($key, $data)) {
                continue;
            }
            $fields[] = "{$key} = :{$key}";
            $bind[$key] = match ($key) {
                'note'         => Validate::nullableString($data[$key]),
                'technique_id' => self::techniqueIdOr404($data[$key], $user['id']),
                default        => $data[$key],
            };
        }

        if ($fields === []) {
            Response::error(400, 'no_fields', 'Nothing to update.');
            return;
        }

        Database::connection()
            ->prepare('UPDATE workout_plan_exercises SET ' . implode(', ', $fields) . ' WHERE id = :id')
            ->execute($bind);

        Response::ok(['ok' => true]);
    }

    public static function deleteExercise(array $params): void
    {
        $user = Auth::requireUser();
        $assignment = self::assignmentOr404($params['id']);
        Acl::require($assignment['trainer_id'] === $user['id']);
        Limits::requireWritable($user['id'], $assignment['athlete_id'] ?? null);
        $day = self::dayOr404($params['id'], $params['dayId']);
        $exercise = self::exerciseOr404($day['id'], $params['exId']);

        Database::connection()
            ->prepare('DELETE FROM workout_plan_exercises WHERE id = :id')
            ->execute(['id' => $exercise['id']]);

        Response::ok(['ok' => true]);
    }

    /** Copies one day (and all its exercises) to another day_number/week_number on the same assignment. */
    public static function copyDay(array $params): void
    {
        $user = Auth::requireUser();
        $assignment = self::assignmentOr404($params['id']);
        Acl::require($assignment['trainer_id'] === $user['id']);
        Limits::requireWritable($user['id'], $assignment['athlete_id'] ?? null);
        $day = self::dayOr404($params['id'], $params['dayId']);

        $data = Validate::required(Validate::body(), ['day_number']);
        $pdo = Database::connection();

        $stmt = $pdo->prepare(
            'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
             FROM workout_plan_days WHERE assignment_id = :assignment_id'
        );
        $stmt->execute(['assignment_id' => $params['id']]);
        $sortOrder = (int) $stmt->fetch()['next_sort_order'];

        $newDayId = Uuid::v4();
        $pdo->prepare(
            'INSERT INTO workout_plan_days (id, assignment_id, week_number, day_number, day_name, sort_order)
             VALUES (:id, :assignment_id, :week_number, :day_number, :day_name, :sort_order)'
        )->execute([
            'id'            => $newDayId,
            'assignment_id' => $params['id'],
            'week_number'   => (int) ($data['week_number'] ?? $day['week_number']),
            'day_number'    => (int) $data['day_number'],
            'day_name'      => $day['day_name'],
            'sort_order'    => $sortOrder,
        ]);

        self::copyExercisesToDay($day['id'], $newDayId);

        Response::ok(['id' => $newDayId], 201);
    }

    /** Copies every day (and exercise) in one week to another week on the same assignment. */
    public static function copyWeek(array $params): void
    {
        $user = Auth::requireUser();
        $assignment = self::assignmentOr404($params['id']);
        Acl::require($assignment['trainer_id'] === $user['id']);
        Limits::requireWritable($user['id'], $assignment['athlete_id'] ?? null);

        $data = Validate::required(Validate::body(), ['target_week_number']);
        $sourceWeek = (int) $params['weekNumber'];
        $targetWeek = (int) $data['target_week_number'];

        $pdo = Database::connection();
        $stmt = $pdo->prepare(
            'SELECT id, day_number, day_name, sort_order FROM workout_plan_days
             WHERE assignment_id = :assignment_id AND week_number = :week_number
             ORDER BY sort_order ASC'
        );
        $stmt->execute(['assignment_id' => $params['id'], 'week_number' => $sourceWeek]);
        $sourceDays = $stmt->fetchAll();

        if ($sourceDays === []) {
            Response::error(404, 'not_found', 'This week has no days to copy.');
            return;
        }

        $stmt = $pdo->prepare(
            'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
             FROM workout_plan_days WHERE assignment_id = :assignment_id'
        );
        $stmt->execute(['assignment_id' => $params['id']]);
        $nextSortOrder = (int) $stmt->fetch()['next_sort_order'];

        $newDayIds = [];
        foreach ($sourceDays as $sourceDay) {
            $newDayId = Uuid::v4();
            $pdo->prepare(
                'INSERT INTO workout_plan_days (id, assignment_id, week_number, day_number, day_name, sort_order)
                 VALUES (:id, :assignment_id, :week_number, :day_number, :day_name, :sort_order)'
            )->execute([
                'id'            => $newDayId,
                'assignment_id' => $params['id'],
                'week_number'   => $targetWeek,
                'day_number'    => $sourceDay['day_number'],
                'day_name'      => $sourceDay['day_name'],
                'sort_order'    => $nextSortOrder++,
            ]);
            $newDayIds[] = $newDayId;
            self::copyExercisesToDay($sourceDay['id'], $newDayId);
        }

        Response::ok(['dayIds' => $newDayIds], 201);
    }

    /** Also used by PlanController::copyStructure (templates), hence public. */
    public static function copyExercisesToDay(string $sourceDayId, string $targetDayId): void
    {
        $pdo = Database::connection();
        $stmt = $pdo->prepare(
            'SELECT exercise_id, sets, reps, weight_kg, rest_seconds, note, technique_id, sort_order
             FROM workout_plan_exercises WHERE day_id = :day_id ORDER BY sort_order ASC'
        );
        $stmt->execute(['day_id' => $sourceDayId]);

        $insert = $pdo->prepare(
            'INSERT INTO workout_plan_exercises (id, day_id, exercise_id, sets, reps, weight_kg, rest_seconds, note, technique_id, sort_order)
             VALUES (:id, :day_id, :exercise_id, :sets, :reps, :weight_kg, :rest_seconds, :note, :technique_id, :sort_order)'
        );
        foreach ($stmt->fetchAll() as $row) {
            $insert->execute([
                'id'           => Uuid::v4(),
                'day_id'       => $targetDayId,
                'exercise_id'  => $row['exercise_id'],
                'sets'         => $row['sets'],
                'reps'         => $row['reps'],
                'weight_kg'    => $row['weight_kg'],
                'rest_seconds' => $row['rest_seconds'],
                'note'         => $row['note'],
                'technique_id' => $row['technique_id'],
                'sort_order'   => $row['sort_order'],
            ]);
        }
    }

    /** @return array<int, array<string, mixed>> */
    public static function daysWithExercises(string $assignmentId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, week_number, day_number, day_name, sort_order
             FROM workout_plan_days
             WHERE assignment_id = :assignment_id
             ORDER BY week_number ASC, day_number ASC, sort_order ASC'
        );
        $stmt->execute(['assignment_id' => $assignmentId]);
        $days = Cast::rows($stmt->fetchAll(), [], ['week_number', 'day_number', 'sort_order']);

        if ($days === []) {
            return [];
        }

        $dayIds = array_column($days, 'id');
        $placeholders = implode(',', array_fill(0, count($dayIds), '?'));
        $media = Database::hasColumn('exercises', 'video_url') ? 'x.image_url, x.video_url,' : '';
        $stmt = Database::connection()->prepare(
            "SELECT e.id, e.day_id, e.exercise_id, e.sets, e.reps, e.weight_kg, e.rest_seconds, e.note, e.technique_id, e.sort_order,
                    x.name AS exercise_name, x.name_en AS exercise_name_en, x.muscle_group, {$media}
                    t.name AS technique_name, t.description AS technique_description
             FROM workout_plan_exercises e
             JOIN exercises x ON x.id = e.exercise_id
             LEFT JOIN techniques t ON t.id = e.technique_id
             WHERE e.day_id IN ({$placeholders})
             ORDER BY e.sort_order ASC"
        );
        $stmt->execute($dayIds);
        $exercises = Cast::rows($stmt->fetchAll(), ['weight_kg'], ['sets', 'rest_seconds', 'sort_order']);

        $byDay = [];
        foreach ($exercises as $exercise) {
            $byDay[$exercise['day_id']][] = $exercise;
        }
        foreach ($days as &$day) {
            $day['exercises'] = $byDay[$day['id']] ?? [];
        }
        unset($day);

        return $days;
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

        $pending = InvoiceController::pendingByItem(InvoiceController::itemTypeFor('workout'), [$assignment['id']]);
        if (isset($pending[$assignment['id']])) {
            Response::error(403, 'plan_locked', 'This plan is locked until its invoice is paid.');
            exit;
        }
    }

    private static function assignmentOr404(string $id): array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM workout_assignments WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $assignment = $stmt->fetch();

        if ($assignment === false) {
            Response::error(404, 'not_found', 'Plan not found.');
            exit;
        }

        return $assignment;
    }

    private static function dayOr404(string $assignmentId, string $dayId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT * FROM workout_plan_days WHERE id = :id AND assignment_id = :assignment_id'
        );
        $stmt->execute(['id' => $dayId, 'assignment_id' => $assignmentId]);
        $day = $stmt->fetch();

        if ($day === false) {
            Response::error(404, 'not_found', 'Day not found.');
            exit;
        }

        return $day;
    }

    private static function exerciseOr404(string $dayId, string $exerciseRowId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT * FROM workout_plan_exercises WHERE id = :id AND day_id = :day_id'
        );
        $stmt->execute(['id' => $exerciseRowId, 'day_id' => $dayId]);
        $exercise = $stmt->fetch();

        if ($exercise === false) {
            Response::error(404, 'not_found', 'Exercise not found.');
            exit;
        }

        return $exercise;
    }

    /**
     * The technique_id a request may attach: absent/''/null means none, anything
     * else must be one of this trainer's own techniques — 404 otherwise, the
     * same answer for someone else's technique as for a made-up id.
     */
    private static function techniqueIdOr404(mixed $techniqueId, string $coachId): ?string
    {
        if ($techniqueId === null || $techniqueId === '') {
            return null;
        }
        if (!is_string($techniqueId) || !TechniqueController::isOwnedBy($techniqueId, $coachId)) {
            Response::error(404, 'not_found', 'Technique not found.');
            exit;
        }
        return $techniqueId;
    }

    private static function markStructured(\PDO $pdo, string $assignmentId): void
    {
        $pdo->prepare(
            "UPDATE workout_assignments SET builder_mode = 'structured' WHERE id = :id AND builder_mode <> 'structured'"
        )->execute(['id' => $assignmentId]);
    }
}
