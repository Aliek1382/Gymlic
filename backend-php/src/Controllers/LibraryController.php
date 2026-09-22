<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Auth;
use Gymlic\Cast;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Uuid;
use Gymlic\Validate;

/**
 * The exercise and food libraries are the same table shape twice over: shared
 * presets (created_by IS NULL) plus each trainer's own additions, with a
 * per-trainer usage counter driving the picker's "most used" order.
 */
final class LibraryController
{
    private const KINDS = [
        'exercises' => [
            'table'       => 'exercises',
            'usage_table' => 'exercise_usage',
            'usage_key'   => 'exercise_id',
            'extra'       => 'muscle_group',
        ],
        'foods' => [
            'table'       => 'foods',
            'usage_table' => 'food_usage',
            'usage_key'   => 'food_id',
            'extra'       => 'category, default_unit',
        ],
    ];

    public static function list(array $params): void
    {
        $user = Auth::requireUser();
        $kind = self::kind($params['kind']);

        // RLS used to hide other trainers' custom entries; now the filter is explicit.
        $stmt = Database::connection()->prepare(
            "SELECT id, name, name_en, description, {$kind['extra']}, created_by, created_at
             FROM {$kind['table']}
             WHERE created_by IS NULL OR created_by = :user_id
             ORDER BY name ASC"
        );
        $stmt->execute(['user_id' => $user['id']]);

        Response::ok(['items' => $stmt->fetchAll()]);
    }

    /** Same library, ordered by how often this trainer has reached for each entry. */
    public static function picker(array $params): void
    {
        $user = Auth::requireUser();
        $kind = self::kind($params['kind']);

        $stmt = Database::connection()->prepare(
            "SELECT l.id, l.name, l.name_en, l.{$kind['extra']}, l.created_by,
                    COALESCE(u.use_count, 0) AS usage_count
             FROM {$kind['table']} l
             LEFT JOIN {$kind['usage_table']} u
               ON u.{$kind['usage_key']} = l.id AND u.trainer_id = :user_id
             WHERE l.created_by IS NULL OR l.created_by = :user_id2
             ORDER BY usage_count DESC, l.name ASC"
        );
        $stmt->execute(['user_id' => $user['id'], 'user_id2' => $user['id']]);

        Response::ok(['items' => Cast::rows($stmt->fetchAll(), [], ['usage_count'])]);
    }

    public static function recordUsage(array $params): void
    {
        $user = Auth::requireUser();
        $kind = self::kind($params['kind']);

        // One statement instead of the client's select-then-update-or-insert,
        // which could double-count under concurrent picks.
        Database::connection()->prepare(
            "INSERT INTO {$kind['usage_table']} (id, trainer_id, {$kind['usage_key']}, use_count, last_used_at)
             VALUES (:id, :trainer_id, :entry_id, 1, NOW())
             ON DUPLICATE KEY UPDATE use_count = use_count + 1, last_used_at = NOW()"
        )->execute([
            'id'         => Uuid::v4(),
            'trainer_id' => $user['id'],
            'entry_id'   => $params['id'],
        ]);

        Response::ok(['ok' => true]);
    }

    public static function create(array $params): void
    {
        $user = Auth::requireUser();
        $kindName = $params['kind'];
        $kind = self::kind($kindName);

        $required = $kindName === 'exercises' ? ['name', 'muscle_group'] : ['name', 'category', 'default_unit'];
        $data = Validate::required(Validate::body(), $required);

        $id = Uuid::v4();

        if ($kindName === 'exercises') {
            Database::connection()->prepare(
                'INSERT INTO exercises (id, name, name_en, description, muscle_group, created_by)
                 VALUES (:id, :name, :name_en, :description, :muscle_group, :created_by)'
            )->execute([
                'id'           => $id,
                'name'         => (string) $data['name'],
                'name_en'      => Validate::nullableString($data['name_en'] ?? null),
                'description'  => Validate::nullableString($data['description'] ?? null),
                'muscle_group' => (string) $data['muscle_group'],
                'created_by'   => $user['id'],
            ]);
        } else {
            Database::connection()->prepare(
                'INSERT INTO foods (id, name, name_en, description, category, default_unit, created_by)
                 VALUES (:id, :name, :name_en, :description, :category, :default_unit, :created_by)'
            )->execute([
                'id'           => $id,
                'name'         => (string) $data['name'],
                'name_en'      => Validate::nullableString($data['name_en'] ?? null),
                'description'  => Validate::nullableString($data['description'] ?? null),
                'category'     => (string) $data['category'],
                'default_unit' => (string) $data['default_unit'],
                'created_by'   => $user['id'],
            ]);
        }

        Response::ok(['id' => $id], 201);
    }

    private static function kind(string $kind): array
    {
        if (!isset(self::KINDS[$kind])) {
            Response::error(404, 'not_found', 'Unknown library.');
            exit;
        }
        return self::KINDS[$kind];
    }
}
