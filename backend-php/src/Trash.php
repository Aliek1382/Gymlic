<?php
declare(strict_types=1);

namespace Gymlic;

use PDO;
use PDOException;
use RuntimeException;

/**
 * The recycle bin (/admin/trash): what an admin deletes is first copied into
 * `trash` as JSON (the row, and every row the database would delete with it)
 * and can be put back for RETENTION_DAYS days.
 *
 * Nothing here is written per table: what goes with a row is read from the
 * database's own foreign keys. ON DELETE CASCADE children are copied (and
 * their children…); ON DELETE SET NULL references are remembered so a
 * restore can point them back. A RESTRICT reference from a row that stays
 * (an activity log entry naming the user, a measurement they recorded) is
 * cleared first when its column may be empty, and put back on restore; when
 * it may not, the delete stops with a message, as the database would.
 *
 * Restoring inserts the rows again, parents before children (by retrying
 * what a foreign key refused until nothing more goes in), all in one
 * transaction: it either comes back whole or not at all.
 */
final class Trash
{
    public const RETENTION_DAYS = 30;

    /** What can be in the bin, and the permission that deletes and restores it. */
    public const KINDS = [
        'user'             => AdminAccess::SUPER,
        'club'             => AdminAccess::SUPER,
        'page'             => 'content',
        'discount'         => 'finance',
        'trainer_discount' => 'finance',
    ];

    /** Logins and one-off codes: never kept, never put back. */
    private const SKIP_TABLES = ['sessions', 'login_challenges', 'login_attempts', 'trash', 'error_logs'];

    /** A copy bigger than this is refused rather than half-stored (shared hosts cap a query's size). */
    private const MAX_PAYLOAD_BYTES = 24 * 1024 * 1024;

    /** @var array<string, list<array{table: string, column: string, refColumn: string, rule: string, nullable: bool}>>|null */
    private static ?array $graph = null;

    /** @var array<string, list<string>> */
    private static array $primaryKeys = [];

    private function __construct()
    {
    }

    /** False until operations-update.sql has run. */
    public static function ready(): bool
    {
        return Database::hasTable('trash');
    }

    /**
     * Copies $roots and everything that goes with them into the bin, then
     * deletes the roots (in reverse order: list a row before the rows that
     * must go first, such as a user before the clubs they own). Call inside a
     * transaction. Throws RuntimeException with a message for the admin when
     * something outside would block the delete.
     *
     * @param list<array{0: string, 1: string, 2: string}> $roots [table, key column, value]
     */
    public static function delete(PDO $pdo, string $kind, array $roots, string $label, ?string $summary, string $adminId): string
    {
        $captured = [];   // "table|key" => [table, row]
        $setNull = [];    // [table, column, keyColumns, keyValues[], value]
        $detach = [];     // the same, for nullable RESTRICT links cleared by hand
        $blockers = [];   // "table|key" => table

        foreach ($roots as [$table, $column, $value]) {
            $stmt = $pdo->prepare("SELECT * FROM `{$table}` WHERE `{$column}` = :v");
            $stmt->execute(['v' => $value]);
            foreach ($stmt->fetchAll() as $row) {
                self::visit($pdo, $table, $row, $captured, $setNull, $detach, $blockers);
            }
        }

        $blocking = array_diff_key($blockers, $captured);
        if ($blocking !== []) {
            $tables = array_count_values(array_values($blocking));
            $parts = [];
            foreach ($tables as $table => $count) {
                $parts[] = "{$table} ({$count})";
            }
            throw new RuntimeException('ردیف‌هایی در جای دیگر به این مورد وابسته‌اند و با حذفش خراب می‌شوند: ' . implode('، ', $parts));
        }

        $payload = json_encode([
            'version'  => 1,
            'roots'    => $roots,
            'rows'     => array_values($captured),
            'set_null' => array_merge($setNull, $detach),
        ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        if ($payload === false || strlen($payload) > self::MAX_PAYLOAD_BYTES) {
            throw new RuntimeException('اطلاعات این مورد برای نگه‌داشتن در سطل زباله بیش از حد بزرگ است.');
        }

        $id = Uuid::v4();
        $pdo->prepare(
            'INSERT INTO trash (id, kind, label, summary, payload, deleted_by) VALUES (:id, :kind, :label, :summary, :payload, :by)'
        )->execute([
            'id'      => $id,
            'kind'    => $kind,
            'label'   => mb_substr($label, 0, 255),
            'summary' => $summary === null ? null : mb_substr($summary, 0, 500),
            'payload' => $payload,
            'by'      => $adminId,
        ]);

        foreach ($detach as [$table, $column, $keyColumns, $keys]) {
            foreach ($keys as $key) {
                [$where, $bind] = self::keyWhere($keyColumns, $key);
                $pdo->prepare("UPDATE `{$table}` SET `{$column}` = NULL WHERE {$where}")->execute($bind);
            }
        }
        // Row by row, children before parents, rather than one cascading
        // DELETE: InnoDB can't order a cascade around a RESTRICT key inside
        // the same set (a trainer's plan still naming the trainer's own
        // exercise). Whatever is still referenced waits for the next round.
        $pending = array_reverse(array_values($captured));
        while ($pending !== []) {
            $left = [];
            foreach ($pending as [$table, $row]) {
                $keyColumns = self::primaryKey($pdo, $table);
                if ($keyColumns === []) {
                    continue; // no key: its parent's cascade takes it
                }
                [$where, $bind] = self::keyWhere($keyColumns, self::keyOf($pdo, $table, $row));
                try {
                    $pdo->prepare("DELETE FROM `{$table}` WHERE {$where}")->execute($bind);
                } catch (PDOException $e) {
                    if ((int) ($e->errorInfo[1] ?? 0) !== 1451) {
                        throw $e;
                    }
                    $left[] = [$table, $row];
                }
            }
            if (count($left) === count($pending)) {
                throw new RuntimeException('ترتیب حذف این مورد پیدا نشد؛ چیزی بیرون از آن هنوز به آن وابسته است (' . $left[0][0] . ').');
            }
            $pending = $left;
        }

        return $id;
    }

    /**
     * Puts an item back and removes it from the bin. Throws RuntimeException
     * (nothing changed) when it can't come back whole.
     *
     * @return array{kind: string, label: string, rows: int}
     */
    public static function restore(PDO $pdo, string $trashId): array
    {
        $item = self::find($pdo, $trashId, true);
        $payload = json_decode((string) $item['payload'], true);
        if (!is_array($payload) || !isset($payload['rows']) || !is_array($payload['rows'])) {
            throw new RuntimeException('اطلاعات این مورد خوانا نیست و قابل بازگرداندن نیست.');
        }

        $pending = $payload['rows'];
        $inserted = 0;
        while ($pending !== []) {
            $left = [];
            foreach ($pending as [$table, $row]) {
                try {
                    self::insert($pdo, (string) $table, (array) $row);
                    $inserted++;
                } catch (PDOException $e) {
                    $code = (int) ($e->errorInfo[1] ?? 0);
                    if ($code === 1452) { // a parent not back yet: try again next round
                        $left[] = [$table, $row];
                        continue;
                    }
                    if ($code === 1062) {
                        throw new RuntimeException(self::duplicateMessage((string) $table));
                    }
                    if ($code === 1146 || $code === 1054) {
                        // A table or column that no longer exists: skip what can't fit.
                        continue;
                    }
                    throw $e;
                }
            }
            if (count($left) === count($pending)) {
                $table = (string) ($left[0][0] ?? '');
                throw new RuntimeException("چیزی که این مورد به آن وابسته بود دیگر وجود ندارد ({$table})؛ بازگرداندن ممکن نیست.");
            }
            $pending = $left;
        }

        foreach ($payload['set_null'] ?? [] as [$table, $column, $keyColumns, $keys, $value]) {
            foreach ($keys as $key) {
                [$where, $bind] = self::keyWhere((array) $keyColumns, $key);
                $bind['v'] = $value;
                try {
                    $pdo->prepare("UPDATE `{$table}` SET `{$column}` = :v WHERE `{$column}` IS NULL AND {$where}")
                        ->execute($bind);
                } catch (PDOException $e) {
                    // A link that can't be put back is not worth failing the restore for.
                }
            }
        }

        $pdo->prepare('DELETE FROM trash WHERE id = :id')->execute(['id' => $trashId]);
        return ['kind' => (string) $item['kind'], 'label' => (string) $item['label'], 'rows' => $inserted];
    }

    /** Deletes one item for good, with what it alone kept on disk. */
    public static function purge(PDO $pdo, string $trashId): array
    {
        $item = self::find($pdo, $trashId, false);
        $pdo->prepare('DELETE FROM trash WHERE id = :id')->execute(['id' => $trashId]);
        self::removeFiles($item);
        return ['kind' => (string) $item['kind'], 'label' => (string) $item['label']];
    }

    /** Everything older than RETENTION_DAYS, for good. Returns how many. */
    public static function purgeExpired(PDO $pdo): int
    {
        if (!self::ready()) {
            return 0;
        }
        $stmt = $pdo->prepare('SELECT id, kind, payload FROM trash WHERE deleted_at < :cutoff');
        $stmt->execute(['cutoff' => date('Y-m-d H:i:s', time() - self::RETENTION_DAYS * 86400)]);
        $count = 0;
        foreach ($stmt->fetchAll() as $item) {
            $pdo->prepare('DELETE FROM trash WHERE id = :id')->execute(['id' => $item['id']]);
            self::removeFiles($item);
            $count++;
        }
        return $count;
    }

    /** purgeExpired at most every few hours, from the admin pages that touch the bin. Never throws. */
    public static function purgeIfDue(PDO $pdo): void
    {
        try {
            $stmt = $pdo->prepare('SELECT value FROM app_settings WHERE setting_key = :key');
            $stmt->execute(['key' => 'cron.trash-purge']);
            $last = json_decode((string) $stmt->fetchColumn(), true);
            if (is_array($last) && isset($last['at']) && strtotime((string) $last['at']) > time() - 6 * 3600) {
                return;
            }
            $count = self::purgeExpired($pdo);
            CronHeartbeat::record('trash-purge', "trash items removed: {$count}");
        } catch (\Throwable $e) {
            error_log('trash purge: ' . $e->getMessage());
        }
    }

    /** User ids whose accounts are in the bin (their upload folders are not orphans yet). */
    public static function userIds(PDO $pdo): array
    {
        if (!self::ready()) {
            return [];
        }
        $ids = [];
        foreach ($pdo->query("SELECT payload FROM trash WHERE kind = 'user'")->fetchAll(PDO::FETCH_COLUMN) as $payload) {
            $roots = json_decode((string) $payload, true)['roots'] ?? [];
            foreach ($roots as $root) {
                if (($root[0] ?? '') === 'profiles') {
                    $ids[] = (string) $root[2];
                }
            }
        }
        return $ids;
    }

    /** Upload URLs inside bin items (a deleted club's logo, say): not orphans while restorable. */
    public static function referencedUploads(PDO $pdo): array
    {
        if (!self::ready()) {
            return [];
        }
        $found = [];
        foreach ($pdo->query('SELECT payload FROM trash')->fetchAll(PDO::FETCH_COLUMN) as $payload) {
            if (preg_match_all('#/uploads/([^"\\\\?\s]+)#', (string) $payload, $m)) {
                foreach ($m[1] as $path) {
                    $found[str_replace('\\/', '/', $path)] = true;
                }
            }
        }
        return array_keys($found);
    }

    private static function visit(PDO $pdo, string $table, array $row, array &$captured, array &$setNull, array &$detach, array &$blockers): void
    {
        $key = $table . '|' . json_encode(self::keyOf($pdo, $table, $row));
        if (isset($captured[$key])) {
            return;
        }
        $captured[$key] = [$table, $row];

        foreach (self::graph($pdo)[$table] ?? [] as $ref) {
            $value = $row[$ref['refColumn']] ?? null;
            if ($value === null || in_array($ref['table'], self::SKIP_TABLES, true)) {
                continue;
            }
            $stmt = $pdo->prepare("SELECT * FROM `{$ref['table']}` WHERE `{$ref['column']}` = :v");
            $stmt->execute(['v' => $value]);
            $children = $stmt->fetchAll();
            if ($children === []) {
                continue;
            }

            if ($ref['rule'] === 'CASCADE') {
                foreach ($children as $child) {
                    self::visit($pdo, $ref['table'], $child, $captured, $setNull, $detach, $blockers);
                }
            } elseif ($ref['rule'] === 'SET NULL' || $ref['nullable']) {
                $keyColumns = self::primaryKey($pdo, $ref['table']);
                $entry = [
                    $ref['table'],
                    $ref['column'],
                    $keyColumns,
                    array_map(static fn (array $child): array => array_map(static fn (string $c) => $child[$c] ?? null, $keyColumns), $children),
                    $value,
                ];
                if ($ref['rule'] === 'SET NULL') {
                    $setNull[] = $entry; // the database clears it itself
                } else {
                    $detach[] = $entry;  // cleared by delete() before the rows go
                }
            } else {
                foreach ($children as $child) {
                    $blockers[$ref['table'] . '|' . json_encode(self::keyOf($pdo, $ref['table'], $child))] = $ref['table'];
                }
            }
        }
    }

    /** referenced table => the foreign keys pointing at it. */
    private static function graph(PDO $pdo): array
    {
        if (self::$graph !== null) {
            return self::$graph;
        }
        $rows = $pdo->query(
            "SELECT k.TABLE_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME, r.DELETE_RULE,
                    c.IS_NULLABLE
             FROM information_schema.KEY_COLUMN_USAGE k
             JOIN information_schema.REFERENTIAL_CONSTRAINTS r
               ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND r.TABLE_NAME = k.TABLE_NAME
             JOIN information_schema.COLUMNS c
               ON c.TABLE_SCHEMA = k.TABLE_SCHEMA AND c.TABLE_NAME = k.TABLE_NAME AND c.COLUMN_NAME = k.COLUMN_NAME
             WHERE k.TABLE_SCHEMA = DATABASE() AND k.REFERENCED_TABLE_NAME IS NOT NULL"
        )->fetchAll();
        $graph = [];
        foreach ($rows as $row) {
            $graph[$row['REFERENCED_TABLE_NAME']][] = [
                'table'     => $row['TABLE_NAME'],
                'column'    => $row['COLUMN_NAME'],
                'refColumn' => $row['REFERENCED_COLUMN_NAME'],
                'rule'      => strtoupper((string) $row['DELETE_RULE']),
                'nullable'  => $row['IS_NULLABLE'] === 'YES',
            ];
        }
        return self::$graph = $graph;
    }

    /** @return list<string> */
    private static function primaryKey(PDO $pdo, string $table): array
    {
        if (!isset(self::$primaryKeys[$table])) {
            $stmt = $pdo->prepare(
                "SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND CONSTRAINT_NAME = 'PRIMARY'
                 ORDER BY ORDINAL_POSITION"
            );
            $stmt->execute(['t' => $table]);
            self::$primaryKeys[$table] = $stmt->fetchAll(PDO::FETCH_COLUMN);
        }
        return self::$primaryKeys[$table];
    }

    private static function keyOf(PDO $pdo, string $table, array $row): array
    {
        $columns = self::primaryKey($pdo, $table);
        if ($columns === []) {
            return $row; // no primary key: the whole row is its identity
        }
        return array_map(static fn (string $c) => $row[$c] ?? null, $columns);
    }

    /** @return array{0: string, 1: array<string, mixed>} a WHERE matching one row by its key columns, and its values */
    private static function keyWhere(array $keyColumns, mixed $key): array
    {
        $where = [];
        $bind = [];
        foreach ($keyColumns as $i => $keyColumn) {
            $where[] = "`{$keyColumn}` = :k{$i}";
            $bind["k{$i}"] = is_array($key) ? ($key[$i] ?? null) : $key;
        }
        return [implode(' AND ', $where), $bind];
    }

    private static function insert(PDO $pdo, string $table, array $row): void
    {
        $columns = array_keys($row);
        $names = implode(', ', array_map(static fn (string $c): string => "`{$c}`", $columns));
        $marks = implode(', ', array_fill(0, count($columns), '?'));
        $pdo->prepare("INSERT INTO `{$table}` ({$names}) VALUES ({$marks})")->execute(array_values($row));
    }

    private static function find(PDO $pdo, string $id, bool $lock): array
    {
        $stmt = $pdo->prepare('SELECT * FROM trash WHERE id = :id' . ($lock ? ' FOR UPDATE' : ''));
        $stmt->execute(['id' => $id]);
        $item = $stmt->fetch();
        if ($item === false) {
            throw new RuntimeException('این مورد در سطل زباله نیست (شاید قبلاً بازگردانده یا پاک شده).');
        }
        return $item;
    }

    private static function duplicateMessage(string $table): string
    {
        return match ($table) {
            'profiles'       => 'ایمیل یا شماره موبایل این حساب حالا مال حساب دیگری است؛ بازگرداندن ممکن نیست.',
            'site_pages'     => 'صفحه‌ای با همین نشانی دوباره ساخته شده؛ اول آن را حذف یا نشانی‌اش را عوض کنید.',
            'discount_codes', 'trainer_discount_codes' => 'کدی با همین متن دوباره ساخته شده؛ اول آن را حذف یا عوض کنید.',
            default          => "بخشی از این مورد ({$table}) دوباره ساخته شده و تکراری می‌شود؛ بازگرداندن ممکن نیست.",
        };
    }

    /** A deleted account's upload folder goes with it once it can't come back. */
    private static function removeFiles(array $item): void
    {
        if ($item['kind'] !== 'user') {
            return;
        }
        $roots = json_decode((string) $item['payload'], true)['roots'] ?? [];
        foreach ($roots as $root) {
            if (($root[0] ?? '') === 'profiles' && preg_match('/^[0-9a-f-]{36}$/i', (string) ($root[2] ?? '')) === 1) {
                Storage::removeUserFolder((string) $root[2]);
            }
        }
    }
}
