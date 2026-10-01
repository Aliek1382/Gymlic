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
 * The exercise, food and supplement libraries are the same table shape three times over: shared
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
            'extra'       => 'category, default_unit, calories_per_unit, protein_g, carbs_g, fat_g',
        ],
        // list() already selects description, so only image_url is extra here.
        'supplements' => [
            'table'       => 'supplements',
            'usage_table' => 'supplement_usage',
            'usage_key'   => 'supplement_id',
            'extra'       => 'image_url',
        ],
    ];

    /** foods.* DECIMAL columns arrive as strings over PDO; NULL (macros not entered yet) stays NULL. */
    private const FOOD_MACROS = ['calories_per_unit', 'protein_g', 'carbs_g', 'fat_g'];

    public static function list(array $params): void
    {
        $user = Auth::requireUser();
        $kind = self::kind($params['kind']);

        // RLS used to hide other trainers' custom entries; now the filter is explicit.
        // The how-to image / video exercises carry once phase 8's SQL has run.
        $media = $params['kind'] === 'exercises' && Database::hasColumn('exercises', 'video_url') ? ', image_url, video_url' : '';
        $stmt = Database::connection()->prepare(
            "SELECT id, name, name_en, description, {$kind['extra']}, created_by, created_at{$media}
             FROM {$kind['table']}
             WHERE (created_by IS NULL OR created_by = :user_id)" . self::notHidden($kind['table'], $kind['table']) . "
             ORDER BY name ASC"
        );
        $stmt->execute(['user_id' => $user['id']]);

        Response::ok(['items' => self::castMacros($params['kind'], $stmt->fetchAll())]);
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
             WHERE (l.created_by IS NULL OR l.created_by = :user_id2)" . self::notHidden($kind['table'], 'l') . "
             ORDER BY usage_count DESC, l.name ASC"
        );
        $stmt->execute(['user_id' => $user['id'], 'user_id2' => $user['id']]);

        Response::ok(['items' => Cast::rows(self::castMacros($params['kind'], $stmt->fetchAll()), [], ['usage_count'])]);
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

        $required = match ($kindName) {
            'exercises'   => ['name', 'muscle_group'],
            'supplements' => ['name'],
            default       => ['name', 'category', 'default_unit'],
        };
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
        } elseif ($kindName === 'supplements') {
            Database::connection()->prepare(
                'INSERT INTO supplements (id, name, name_en, description, created_by)
                 VALUES (:id, :name, :name_en, :description, :created_by)'
            )->execute([
                'id'          => $id,
                'name'        => (string) $data['name'],
                'name_en'     => Validate::nullableString($data['name_en'] ?? null),
                'description' => Validate::nullableString($data['description'] ?? null),
                'created_by'  => $user['id'],
            ]);
        } else {
            // Macros are per one default_unit and all optional: NULL means "not
            // entered yet", which the plan builder counts as zero and flags.
            Database::connection()->prepare(
                'INSERT INTO foods (id, name, name_en, description, category, default_unit,
                                    calories_per_unit, protein_g, carbs_g, fat_g, created_by)
                 VALUES (:id, :name, :name_en, :description, :category, :default_unit,
                         :calories_per_unit, :protein_g, :carbs_g, :fat_g, :created_by)'
            )->execute([
                'id'           => $id,
                'name'         => (string) $data['name'],
                'name_en'      => Validate::nullableString($data['name_en'] ?? null),
                'description'  => Validate::nullableString($data['description'] ?? null),
                'category'     => (string) $data['category'],
                'default_unit' => (string) $data['default_unit'],
                'calories_per_unit' => Validate::nullableNumber($data['calories_per_unit'] ?? null, 'calories_per_unit', 99999.99),
                'protein_g'    => Validate::nullableNumber($data['protein_g'] ?? null, 'protein_g', 9999.99),
                'carbs_g'      => Validate::nullableNumber($data['carbs_g'] ?? null, 'carbs_g', 9999.99),
                'fat_g'        => Validate::nullableNumber($data['fat_g'] ?? null, 'fat_g', 9999.99),
                'created_by'   => $user['id'],
            ]);
        }

        Response::ok(['id' => $id], 201);
    }

    /**
     * Leaves out what the admin hid from /admin/library. Plans that already
     * use a hidden entry still show it: they join it by id, not through here.
     */
    private static function notHidden(string $table, string $alias): string
    {
        return Database::hasColumn($table, 'is_hidden') ? " AND {$alias}.is_hidden = 0" : '';
    }

    /** @param array<int, array<string, mixed>> $rows */
    private static function castMacros(string $kindName, array $rows): array
    {
        return $kindName === 'foods' ? Cast::rows($rows, self::FOOD_MACROS) : $rows;
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
