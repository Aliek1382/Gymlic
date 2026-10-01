<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Uuid;
use Gymlic\Validate;
use Gymlic\ContentLibrary;

/**
 * A trainer's own technique bank (drop-set, super-set…), attached to the
 * exercises of a structured workout plan. Unlike the exercise/food libraries
 * there are no shared presets: every row belongs to exactly one coach and is
 * only ever listed or changed by them. Deleting one leaves the plan rows that
 * used it intact — workout_plan_exercises.technique_id is ON DELETE SET NULL.
 */
final class TechniqueController
{
    public static function list(): void
    {
        $user = Auth::requireUser();

        $stmt = Database::connection()->prepare(
            'SELECT id, name, description, created_at
             FROM techniques WHERE coach_id = :coach_id' . ContentLibrary::ownOnly() . ' ORDER BY name ASC'
        );
        $stmt->execute(['coach_id' => $user['id']]);

        Response::ok(['items' => $stmt->fetchAll()]);
    }

    public static function create(): void
    {
        $user = Auth::requireUser();
        $data = Validate::required(Validate::body(), ['name']);
        $name = self::name($data['name']);

        $id = Uuid::v4();
        try {
            Database::connection()->prepare(
                'INSERT INTO techniques (id, coach_id, name, description)
                 VALUES (:id, :coach_id, :name, :description)'
            )->execute([
                'id'          => $id,
                'coach_id'    => $user['id'],
                'name'        => $name,
                'description' => Validate::nullableString(self::text($data['description'] ?? null)),
            ]);
        } catch (\PDOException $e) {
            self::rethrowUnlessDuplicate($e);
            return;
        }

        Response::ok(['id' => $id], 201);
    }

    public static function update(array $params): void
    {
        $user = Auth::requireUser();
        $technique = self::ownedOr404($params['id'], $user['id']);

        $data = Validate::body();
        $fields = [];
        $bind = ['id' => $technique['id']];

        if (array_key_exists('name', $data)) {
            $fields[] = 'name = :name';
            $bind['name'] = self::name($data['name']);
        }
        if (array_key_exists('description', $data)) {
            $fields[] = 'description = :description';
            $bind['description'] = Validate::nullableString(self::text($data['description']));
        }

        if ($fields === []) {
            Response::error(400, 'no_fields', 'Nothing to update.');
            return;
        }

        try {
            Database::connection()
                ->prepare('UPDATE techniques SET ' . implode(', ', $fields) . ' WHERE id = :id')
                ->execute($bind);
        } catch (\PDOException $e) {
            self::rethrowUnlessDuplicate($e);
            return;
        }

        Response::ok(['ok' => true]);
    }

    public static function delete(array $params): void
    {
        $user = Auth::requireUser();
        $technique = self::ownedOr404($params['id'], $user['id']);

        // The FK nulls technique_id on every plan row that used it.
        Database::connection()
            ->prepare('DELETE FROM techniques WHERE id = :id')
            ->execute(['id' => $technique['id']]);

        Response::ok(['ok' => true]);
    }

    /** True when $id is a technique of $coachId — for callers that accept a technique_id. */
    public static function isOwnedBy(string $id, string $coachId): bool
    {
        $stmt = Database::connection()->prepare(
            'SELECT 1 FROM techniques WHERE id = :id AND coach_id = :coach_id'
        );
        $stmt->execute(['id' => $id, 'coach_id' => $coachId]);
        return $stmt->fetchColumn() !== false;
    }

    private static function ownedOr404(string $id, string $coachId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT * FROM techniques WHERE id = :id AND coach_id = :coach_id' . ContentLibrary::ownOnly()
        );
        $stmt->execute(['id' => $id, 'coach_id' => $coachId]);
        $technique = $stmt->fetch();

        // 404 for someone else's row too, so ids can't be probed.
        if ($technique === false) {
            Response::error(404, 'not_found', 'Technique not found.');
            exit;
        }

        return $technique;
    }

    private static function name(mixed $value): string
    {
        $name = trim(is_string($value) ? $value : '');
        if ($name === '' || mb_strlen($name) > 255) {
            Response::error(400, 'invalid_name', 'Technique name must be 1 to 255 characters.');
            exit;
        }
        return $name;
    }

    private static function text(mixed $value): ?string
    {
        return is_string($value) ? trim($value) : null;
    }

    private static function rethrowUnlessDuplicate(\PDOException $e): void
    {
        // uq_techniques_coach_name: this coach already has a technique by that name.
        if ($e->getCode() === '23000' && str_contains($e->getMessage(), 'uq_techniques_coach_name')) {
            Response::error(409, 'technique_exists', 'You already have a technique with this name.');
            return;
        }
        throw $e;
    }
}
