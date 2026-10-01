<?php
declare(strict_types=1);

namespace Gymlic;

use Gymlic\Controllers\PlanController;
use Gymlic\Controllers\QuestionnaireController;
use Gymlic\Controllers\WorkoutPlanBuilderController;
use PDO;

/**
 * Ready-made content the admin offers every trainer: workout and nutrition
 * plan templates, techniques and questionnaires. They live in the same
 * tables as a trainer's own, owned by an admin and marked is_public = 1.
 *
 * Nobody uses a public row directly: a trainer copies it into their own
 * (and the admin publishes by copying a trainer's), so everything that
 * already checks "is this the trainer's own?" keeps working unchanged, and
 * the admin can edit or remove public content without touching anyone's copy.
 */
final class ContentLibrary
{
    public const KINDS = ['workout', 'nutrition', 'technique', 'questionnaire'];

    private function __construct()
    {
    }

    /** False until content-update.sql has been run. */
    public static function ready(): bool
    {
        return Database::hasColumn('techniques', 'is_public')
            && Database::hasColumn('questionnaires', 'is_public')
            && Database::hasColumn('workout_assignments', 'is_public')
            && Database::hasColumn('nutrition_assignments', 'is_public');
    }

    /** " AND <alias>is_public = 0" once the column exists, for the trainer's own lists. */
    public static function ownOnly(string $alias = ''): string
    {
        return self::ready() ? " AND {$alias}is_public = 0" : '';
    }

    /**
     * The public items of one kind, newest first, with a size summary.
     *
     * @return list<array<string, mixed>>
     */
    public static function listPublic(PDO $pdo, string $kind): array
    {
        $rows = match ($kind) {
            'workout' => $pdo->query(
                "SELECT a.id, a.title, a.description, a.assigned_at AS created_at,
                        (SELECT COUNT(DISTINCT d.week_number) FROM workout_plan_days d WHERE d.assignment_id = a.id) AS weeks,
                        (SELECT COUNT(*) FROM workout_plan_days d WHERE d.assignment_id = a.id) AS days,
                        (SELECT COUNT(*) FROM workout_plan_exercises e JOIN workout_plan_days d ON d.id = e.day_id
                          WHERE d.assignment_id = a.id) AS items
                 FROM workout_assignments a WHERE a.is_template = 1 AND a.is_public = 1 ORDER BY a.assigned_at DESC"
            )->fetchAll(),
            'nutrition' => $pdo->query(
                "SELECT a.id, a.title, a.description, a.assigned_at AS created_at,
                        (SELECT COUNT(*) FROM nutrition_plan_meals m WHERE m.assignment_id = a.id) AS days,
                        (SELECT COUNT(*) FROM nutrition_plan_items i JOIN nutrition_plan_meals m ON m.id = i.meal_id
                          WHERE m.assignment_id = a.id) AS items
                 FROM nutrition_assignments a WHERE a.is_template = 1 AND a.is_public = 1 ORDER BY a.assigned_at DESC"
            )->fetchAll(),
            'technique' => $pdo->query(
                'SELECT id, name AS title, description, created_at FROM techniques WHERE is_public = 1 ORDER BY name'
            )->fetchAll(),
            'questionnaire' => $pdo->query(
                'SELECT q.id, q.title, q.description, q.created_at,
                        (SELECT COUNT(*) FROM questionnaire_questions x WHERE x.questionnaire_id = q.id) AS items
                 FROM questionnaires q WHERE q.is_public = 1 ORDER BY q.created_at DESC'
            )->fetchAll(),
        };
        return Cast::rows($rows, [], ['weeks', 'days', 'items']);
    }

    /** One public item with everything a preview shows, or null. */
    public static function detail(PDO $pdo, string $kind, string $id, bool $publicOnly = true): ?array
    {
        $row = self::row($pdo, $kind, $id);
        if ($row === null || ($publicOnly && !(bool) $row['is_public'])) {
            return null;
        }

        $out = [
            'id'          => $row['id'],
            'title'       => $row['title'] ?? $row['name'],
            'description' => $row['description'],
        ];

        if ($kind === 'workout') {
            $out['days'] = WorkoutPlanBuilderController::daysWithExercises($id);
        } elseif ($kind === 'nutrition') {
            $meals = $pdo->prepare('SELECT id, meal_name FROM nutrition_plan_meals WHERE assignment_id = :id ORDER BY sort_order');
            $meals->execute(['id' => $id]);
            $items = $pdo->prepare(
                'SELECT i.meal_id, f.name AS food_name, i.amount, i.unit, i.note
                 FROM nutrition_plan_items i JOIN nutrition_plan_meals m ON m.id = i.meal_id
                 JOIN foods f ON f.id = i.food_id
                 WHERE m.assignment_id = :id ORDER BY i.sort_order'
            );
            $items->execute(['id' => $id]);
            $byMeal = [];
            foreach (Cast::rows($items->fetchAll(), ['amount']) as $item) {
                $byMeal[$item['meal_id']][] = $item;
            }
            $out['meals'] = array_map(
                static fn (array $m): array => ['id' => $m['id'], 'meal_name' => $m['meal_name'], 'items' => $byMeal[$m['id']] ?? []],
                $meals->fetchAll()
            );
        } elseif ($kind === 'questionnaire') {
            $out['questions'] = QuestionnaireController::questionsFor([$id])[$id] ?? [];
        }

        return $out;
    }

    /**
     * Copies $sourceId to a new row owned by $ownerId: a trainer's own copy
     * ($public false) or a public one the admin publishes ($public true).
     * Returns the new id.
     */
    public static function copy(PDO $pdo, string $kind, string $sourceId, string $ownerId, bool $public): string
    {
        $source = self::row($pdo, $kind, $sourceId);
        if ($source === null) {
            throw new \RuntimeException('source_missing');
        }
        $flag = $public ? 1 : 0;
        $id = Uuid::v4();

        if ($kind === 'technique') {
            return self::techniqueFor($pdo, $ownerId, (string) $source['name'], $source['description'], $public);
        }

        if ($kind === 'questionnaire') {
            $pdo->prepare(
                'INSERT INTO questionnaires (id, coach_id, title, description, price_toman, is_active, is_public)
                 VALUES (:id, :coach_id, :title, :description, NULL, 1, :public)'
            )->execute(['id' => $id, 'coach_id' => $ownerId, 'title' => $source['title'], 'description' => $source['description'], 'public' => $flag]);
            $questions = QuestionnaireController::questionsFor([$sourceId])[$sourceId] ?? [];
            if ($questions !== []) {
                QuestionnaireController::insertQuestions($id, $questions);
            }
            return $id;
        }

        $table = $kind === 'workout' ? 'workout_assignments' : 'nutrition_assignments';
        $pdo->prepare(
            "INSERT INTO {$table} (id, trainer_id, title, description, is_template, is_public)
             VALUES (:id, :trainer_id, :title, :description, 1, :public)"
        )->execute(['id' => $id, 'trainer_id' => $ownerId, 'title' => $source['title'], 'description' => $source['description'], 'public' => $flag]);
        PlanController::copyStructure($sourceId, $id, $kind);

        if ($kind === 'workout') {
            self::remapTechniques($pdo, $id, $ownerId, $public);
        }
        return $id;
    }

    /**
     * Library entries a trainer's plan uses that only that trainer has
     * (their own exercises or foods). A public template must not point at
     * them: the next trainer could neither see nor edit them, and they go
     * when their owner deletes them. Returns their names.
     *
     * @return list<string>
     */
    public static function privateLibraryItems(PDO $pdo, string $kind, string $planId): array
    {
        $sql = $kind === 'workout'
            ? 'SELECT DISTINCT x.name FROM workout_plan_exercises e
               JOIN workout_plan_days d ON d.id = e.day_id JOIN exercises x ON x.id = e.exercise_id
               WHERE d.assignment_id = :id AND x.created_by IS NOT NULL'
            : 'SELECT DISTINCT f.name FROM nutrition_plan_items i
               JOIN nutrition_plan_meals m ON m.id = i.meal_id JOIN foods f ON f.id = i.food_id
               WHERE m.assignment_id = :id AND f.created_by IS NOT NULL';
        $stmt = $pdo->prepare($sql);
        $stmt->execute(['id' => $planId]);
        return array_map('strval', $stmt->fetchAll(PDO::FETCH_COLUMN));
    }

    /** The row behind an item of any kind (public or not), or null. */
    public static function row(PDO $pdo, string $kind, string $id): ?array
    {
        $sql = match ($kind) {
            'workout'       => 'SELECT id, trainer_id AS owner_id, title, description, is_template, is_public FROM workout_assignments WHERE id = :id',
            'nutrition'     => 'SELECT id, trainer_id AS owner_id, title, description, is_template, is_public FROM nutrition_assignments WHERE id = :id',
            'technique'     => 'SELECT id, coach_id AS owner_id, name, description, is_public FROM techniques WHERE id = :id',
            'questionnaire' => 'SELECT id, coach_id AS owner_id, title, description, is_public FROM questionnaires WHERE id = :id',
            default         => throw new \InvalidArgumentException("Unknown content kind: {$kind}"),
        };
        $stmt = $pdo->prepare($sql);
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if ($row === false || (in_array($kind, ['workout', 'nutrition'], true) && (int) $row['is_template'] !== 1)) {
            return null;
        }
        return $row;
    }

    /**
     * $ownerId's technique called $name: theirs if they already have one by
     * that name (names are unique per owner), otherwise a new one.
     */
    private static function techniqueFor(PDO $pdo, string $ownerId, string $name, ?string $description, bool $public): string
    {
        $existing = $pdo->prepare('SELECT id FROM techniques WHERE coach_id = :coach_id AND name = :name');
        $existing->execute(['coach_id' => $ownerId, 'name' => $name]);
        $found = $existing->fetchColumn();
        if ($found !== false) {
            return (string) $found;
        }
        $id = Uuid::v4();
        $pdo->prepare(
            'INSERT INTO techniques (id, coach_id, name, description, is_public) VALUES (:id, :coach_id, :name, :description, :public)'
        )->execute(['id' => $id, 'coach_id' => $ownerId, 'name' => $name, 'description' => $description, 'public' => $public ? 1 : 0]);
        return $id;
    }

    /**
     * The copied plan still points at the source owner's techniques; point
     * it at the new owner's (by name, made if missing) so the trainer can
     * edit the plan like any of their own.
     */
    private static function remapTechniques(PDO $pdo, string $assignmentId, string $ownerId, bool $public): void
    {
        $stmt = $pdo->prepare(
            'SELECT DISTINCT t.id, t.name, t.description FROM workout_plan_exercises e
             JOIN workout_plan_days d ON d.id = e.day_id JOIN techniques t ON t.id = e.technique_id
             WHERE d.assignment_id = :id'
        );
        $stmt->execute(['id' => $assignmentId]);
        $update = $pdo->prepare(
            'UPDATE workout_plan_exercises e JOIN workout_plan_days d ON d.id = e.day_id
             SET e.technique_id = :to WHERE d.assignment_id = :id AND e.technique_id = :from'
        );
        foreach ($stmt->fetchAll() as $technique) {
            $to = self::techniqueFor($pdo, $ownerId, (string) $technique['name'], $technique['description'], $public);
            if ($to !== $technique['id']) {
                $update->execute(['to' => $to, 'id' => $assignmentId, 'from' => $technique['id']]);
            }
        }
    }
}
