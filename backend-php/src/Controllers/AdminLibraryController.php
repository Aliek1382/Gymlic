<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Auth;
use Gymlic\Cast;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Uuid;
use Gymlic\Validate;
use PDOException;

/**
 * The platform admin's side of the exercise, food and supplement libraries:
 * the shared bank (created_by IS NULL) that used to be editable only by SQL,
 * plus a read of what trainers added for themselves, any of which can be
 * moved into the shared bank.
 */
final class AdminLibraryController
{
    private const LIST_LIMIT = 500;

    /**
     * fields: editable text columns beyond name/name_en/description, with
     * whether each is required. plan_table/plan_key: where plans reference an
     * entry, which is what makes it undeletable.
     */
    private const KINDS = [
        'exercises' => [
            'table'      => 'exercises',
            'label'      => 'حرکت',
            'fields'     => ['muscle_group' => true],
            'numbers'    => [],
            'plan_table' => 'workout_plan_exercises',
            'plan_key'   => 'exercise_id',
        ],
        'foods' => [
            'table'      => 'foods',
            'label'      => 'غذا',
            'fields'     => ['category' => true, 'default_unit' => true],
            // column => max, matching the DECIMAL columns (see LibraryController::create)
            'numbers'    => ['calories_per_unit' => 99999.99, 'protein_g' => 9999.99, 'carbs_g' => 9999.99, 'fat_g' => 9999.99],
            'plan_table' => 'nutrition_plan_items',
            'plan_key'   => 'food_id',
        ],
        'supplements' => [
            'table'      => 'supplements',
            'label'      => 'مکمل',
            'fields'     => [],
            'numbers'    => [],
            'plan_table' => 'supplement_plan_items',
            'plan_key'   => 'supplement_id',
        ],
    ];

    /** ?scope=public (the shared bank, default) | custom (trainers' own); ?q= filters by name. */
    public static function list(array $params): void
    {
        Auth::requirePlatformAdmin();
        $kind = self::kind($params['kind']);
        $pdo = Database::connection();

        $scope = ($_GET['scope'] ?? 'public') === 'custom' ? 'l.created_by IS NOT NULL' : 'l.created_by IS NULL';
        $q = trim((string) ($_GET['q'] ?? ''));
        $bind = [];
        $search = '';
        if ($q !== '') {
            $search = ' AND (l.name LIKE :q1 OR l.name_en LIKE :q2)';
            $bind['q1'] = '%' . $q . '%';
            $bind['q2'] = '%' . $q . '%';
        }

        $columns = ['l.id', 'l.name', 'l.name_en', 'l.description', 'l.created_by', 'l.created_at'];
        foreach (array_merge(array_keys($kind['fields']), array_keys($kind['numbers'])) as $column) {
            $columns[] = 'l.' . $column;
        }
        $columns[] = self::hiddenReady($kind) ? 'l.is_hidden' : '0 AS is_hidden';

        $stmt = $pdo->prepare(
            'SELECT ' . implode(', ', $columns) . ",
                    p.first_name AS creator_first_name, p.last_name AS creator_last_name,
                    (SELECT COUNT(*) FROM {$kind['plan_table']} x WHERE x.{$kind['plan_key']} = l.id) AS plan_usage
             FROM {$kind['table']} l
             LEFT JOIN profiles p ON p.id = l.created_by
             WHERE {$scope}{$search}
             ORDER BY l.name ASC
             LIMIT " . self::LIST_LIMIT
        );
        $stmt->execute($bind);

        $counts = $pdo->query(
            "SELECT SUM(created_by IS NULL) AS public_count, SUM(created_by IS NOT NULL) AS custom_count
             FROM {$kind['table']}"
        )->fetch();

        Response::ok([
            'items'        => Cast::rows($stmt->fetchAll(), array_keys($kind['numbers']), ['plan_usage'], ['is_hidden']),
            'public_count' => (int) ($counts['public_count'] ?? 0),
            'custom_count' => (int) ($counts['custom_count'] ?? 0),
            'hide_ready'   => self::hiddenReady($kind),
        ]);
    }

    /** A new entry in the shared bank. */
    public static function create(array $params): void
    {
        $admin = Auth::requirePlatformAdmin();
        $kind = self::kind($params['kind']);
        $values = self::values($kind, Validate::body(), true);

        $values['id'] = Uuid::v4();
        $columns = array_keys($values);
        Database::connection()->prepare(
            "INSERT INTO {$kind['table']} (" . implode(', ', $columns) . ')
             VALUES (:' . implode(', :', $columns) . ')'
        )->execute($values);

        self::log($admin['id'], 'library_item_created', $params['kind'], $values['name']);
        Response::ok(['id' => $values['id']], 201);
    }

    /** Edits any entry, shared or a trainer's; also hides/unhides it. */
    public static function update(array $params): void
    {
        $admin = Auth::requirePlatformAdmin();
        $kind = self::kind($params['kind']);
        $data = Validate::body();
        $entry = self::find($kind, $params['id']);

        $values = self::values($kind, $data, false);
        if (array_key_exists('is_hidden', $data)) {
            if (!self::hiddenReady($kind)) {
                Response::error(503, 'schema_missing', 'برای پنهان‌کردن، اول دستور library-hidden-update.sql را در phpMyAdmin اجرا کنید.');
                return;
            }
            $values['is_hidden'] = (int) (bool) $data['is_hidden'];
        }
        if ($values === []) {
            Response::error(400, 'no_fields', 'Nothing to update.');
            return;
        }

        $sets = array_map(static fn (string $c): string => "{$c} = :{$c}", array_keys($values));
        Database::connection()
            ->prepare("UPDATE {$kind['table']} SET " . implode(', ', $sets) . ' WHERE id = :id')
            ->execute($values + ['id' => $params['id']]);

        self::log($admin['id'], 'library_item_updated', $params['kind'], $values['name'] ?? $entry['name']);
        Response::ok(['ok' => true]);
    }

    /** Only an entry no plan uses; anything else can be hidden instead. */
    public static function delete(array $params): void
    {
        $admin = Auth::requirePlatformAdmin();
        $kind = self::kind($params['kind']);
        $entry = self::find($kind, $params['id']);
        $pdo = Database::connection();

        $used = $pdo->prepare("SELECT COUNT(*) FROM {$kind['plan_table']} WHERE {$kind['plan_key']} = :id");
        $used->execute(['id' => $params['id']]);
        $usage = (int) $used->fetchColumn();
        if ($usage > 0) {
            self::inUse($usage);
            return;
        }

        try {
            $pdo->prepare("DELETE FROM {$kind['table']} WHERE id = :id")->execute(['id' => $params['id']]);
        } catch (PDOException $e) {
            // A plan picked it up between the check and the delete.
            self::inUse(null);
            return;
        }

        self::log($admin['id'], 'library_item_deleted', $params['kind'], $entry['name']);
        Response::ok(['ok' => true]);
    }

    /** Moves a trainer's own entry into the shared bank, for every trainer to use. */
    public static function publish(array $params): void
    {
        $admin = Auth::requirePlatformAdmin();
        $kind = self::kind($params['kind']);
        $entry = self::find($kind, $params['id']);

        if ($entry['created_by'] === null) {
            Response::error(409, 'already_public', 'این مورد همین حالا در بانک عمومی است.');
            return;
        }

        Database::connection()
            ->prepare("UPDATE {$kind['table']} SET created_by = NULL WHERE id = :id")
            ->execute(['id' => $params['id']]);

        self::log($admin['id'], 'library_item_published', $params['kind'], $entry['name']);
        Response::ok(['ok' => true]);
    }

    /**
     * The row values from a request body. On create every required field must
     * be there; on update only what was sent is touched.
     *
     * @return array<string, mixed>
     */
    private static function values(array $kind, array $data, bool $isCreate): array
    {
        $values = [];

        $text = ['name' => true, 'name_en' => false, 'description' => false] + $kind['fields'];
        foreach ($text as $column => $required) {
            if (!array_key_exists($column, $data)) {
                if ($isCreate && $required) {
                    Response::error(400, 'missing_fields', "Missing required field(s): {$column}");
                    exit;
                }
                continue;
            }
            $value = Validate::nullableString(trim((string) ($data[$column] ?? '')));
            if ($required && $value === null) {
                Response::error(400, 'missing_fields', "Missing required field(s): {$column}");
                exit;
            }
            $max = $column === 'description' ? 5000 : ($column === 'default_unit' ? 50 : ($column === 'name' || $column === 'name_en' ? 255 : 100));
            if ($value !== null && mb_strlen($value) > $max) {
                Response::error(400, 'too_long', "{$column} is too long.");
                exit;
            }
            $values[$column] = $value;
        }

        foreach ($kind['numbers'] as $column => $max) {
            if (array_key_exists($column, $data)) {
                $values[$column] = Validate::nullableNumber($data[$column], $column, $max);
            }
        }

        return $values;
    }

    private static function find(array $kind, string $id): array
    {
        $stmt = Database::connection()->prepare("SELECT id, name, created_by FROM {$kind['table']} WHERE id = :id");
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if ($row === false) {
            Response::error(404, 'not_found', 'این مورد پیدا نشد.');
            exit;
        }
        return $row;
    }

    private static function inUse(?int $count): void
    {
        $digits = ['0' => '۰', '1' => '۱', '2' => '۲', '3' => '۳', '4' => '۴', '5' => '۵', '6' => '۶', '7' => '۷', '8' => '۸', '9' => '۹'];
        $where = $count !== null ? 'در ' . strtr((string) $count, $digits) . ' ردیف از برنامه‌ها' : 'در برنامه‌ها';
        Response::error(
            409,
            'in_use',
            "این مورد {$where} استفاده شده و حذف نمی‌شود. به‌جای حذف، آن را پنهان کنید تا دیگر به مربی‌ها نشان داده نشود."
        );
    }

    private static function hiddenReady(array $kind): bool
    {
        return Database::hasColumn($kind['table'], 'is_hidden');
    }

    private static function log(string $adminId, string $action, string $kind, string $name): void
    {
        AdminController::logActivity(Database::connection(), null, $adminId, null, $action, [
            'kind' => $kind,
            'name' => $name,
        ]);
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
