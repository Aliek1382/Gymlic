<?php
declare(strict_types=1);

namespace Gymlic;

use PDO;
use PDOException;

/**
 * Access the admin sets by hand for one trainer or one club, on top of what
 * their plan gives (account-access-update.sql): trainer_access / club_access.
 *
 *   tier     — a fixed tier (Tiers), whatever their subscription says.
 *   features — sections switched on or off one by one: {key: true|false};
 *              a key that isn't there follows the tier.
 *   limits   — trainers only: max_custom_exercises, max_templates and
 *              history_months (a number, or -1 for no limit), report_level
 *              (Limits::REPORT_LEVELS). A key that isn't there follows the
 *              plan. Like the plan's own caps, enforced only once the admin
 *              switches plan limits on (Limits::enforcing).
 *
 * Unlike a subscription's cap override, this stays until the admin clears
 * it: a new plan or a renewal doesn't touch it.
 *
 * Whose row counts (Tiers::subjects): a trainer's own, then their club's;
 * an athlete's trainer's (then that trainer's club), or else their club's; a
 * club owner's club's. The first row that says something about a section
 * decides it.
 *
 * Both tables are small (only accounts the admin has touched), so they are
 * read whole, once per request.
 */
final class AccountAccess
{
    public const KINDS = ['trainer' => 'trainer_access', 'club' => 'club_access'];

    private const ID_COLUMN = ['trainer' => 'trainer_id', 'club' => 'club_id'];

    /** Trainer caps that take a number (-1 = no limit). */
    public const NUMBER_LIMITS = ['max_custom_exercises', 'max_templates', 'history_months'];

    /** @var array<string, array<string, array<string, mixed>>>|null kind => id => row */
    private static ?array $rows = null;

    private function __construct()
    {
    }

    /** False until account-access-update.sql has run. */
    public static function ready(): bool
    {
        return Database::hasTable('trainer_access') && Database::hasTable('club_access');
    }

    /**
     * One account's row, decoded; null when the admin set nothing for it.
     *
     * @return array{tier: ?string, features: array<string, bool>, limits: array<string, int|string>, note: ?string, updated_at: string, updated_by: ?string}|null
     */
    public static function get(PDO $pdo, string $kind, string $id): ?array
    {
        return self::all($pdo)[$kind][$id] ?? null;
    }

    /** What the account's row says about a section: true/false, null = nothing. */
    public static function feature(PDO $pdo, string $kind, string $id, string $feature): ?bool
    {
        return self::get($pdo, $kind, $id)['features'][$feature] ?? null;
    }

    /** Whether some account has this section switched off by hand (Gate then looks the user up). */
    public static function closesAnywhere(PDO $pdo, string $feature): bool
    {
        foreach (self::all($pdo) as $rows) {
            foreach ($rows as $row) {
                if (($row['features'][$feature] ?? null) === false) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Saves the account's access; with nothing left to say (no tier, no
     * section, no cap) the row is removed.
     *
     * @param array<string, bool> $features
     * @param array<string, int|string> $limits
     */
    public static function save(PDO $pdo, string $kind, string $id, ?string $tier, array $features, array $limits, ?string $note, string $adminId): void
    {
        $table = self::KINDS[$kind];
        $column = self::ID_COLUMN[$kind];
        if ($tier === null && $features === [] && $limits === []) {
            $pdo->prepare("DELETE FROM {$table} WHERE {$column} = :id")->execute(['id' => $id]);
        } else {
            $pdo->prepare(
                "INSERT INTO {$table} ({$column}, tier, features, limits, note, updated_by)
                 VALUES (:id, :tier, :features, :limits, :note, :admin)
                 ON DUPLICATE KEY UPDATE tier = VALUES(tier), features = VALUES(features), limits = VALUES(limits),
                   note = VALUES(note), updated_by = VALUES(updated_by), updated_at = NOW()"
            )->execute([
                'id'       => $id,
                'tier'     => $tier,
                'features' => $features === [] ? null : json_encode($features),
                'limits'   => $limits === [] ? null : json_encode($limits),
                'note'     => $note,
                'admin'    => $adminId,
            ]);
        }
        self::$rows = null;
    }

    /**
     * The client's input, cleaned: known sections only, caps in range.
     * Returns [tier, features, limits] or an error message.
     *
     * @return array{0: ?string, 1: array<string, bool>, 2: array<string, int|string>}|string
     */
    public static function clean(string $kind, array $data): array|string
    {
        $tier = $data['tier'] ?? null;
        if ($tier === '' || $tier === null) {
            $tier = null;
        } elseif (!Tiers::valid($tier)) {
            return 'سطح انتخاب‌شده معتبر نیست.';
        }

        $features = [];
        foreach (is_array($data['features'] ?? null) ? $data['features'] : [] as $key => $value) {
            if (isset(Features::CATALOG[$key]) && is_bool($value)) {
                $features[(string) $key] = $value;
            }
        }

        $limits = [];
        if ($kind === 'trainer') {
            $raw = is_array($data['limits'] ?? null) ? $data['limits'] : [];
            foreach (self::NUMBER_LIMITS as $key) {
                $value = $raw[$key] ?? null;
                if ($value === null || $value === '') {
                    continue;
                }
                $value = filter_var($value, FILTER_VALIDATE_INT);
                if ($value === false || $value < -1 || $value > 1_000_000) {
                    return 'سقف‌ها باید عدد صحیح نامنفی باشند (یا «بدون محدودیت»).';
                }
                $limits[$key] = $value;
            }
            $level = $raw['report_level'] ?? null;
            if ($level !== null && $level !== '') {
                if (!in_array($level, Limits::REPORT_LEVELS, true)) {
                    return 'سطح گزارش معتبر نیست.';
                }
                $limits['report_level'] = $level;
            }
        }

        return [$tier, $features, $limits];
    }

    /**
     * Every row of both tables, decoded (none before the SQL has run).
     *
     * @return array<string, array<string, array<string, mixed>>>
     */
    private static function all(PDO $pdo): array
    {
        if (self::$rows !== null) {
            return self::$rows;
        }
        self::$rows = ['trainer' => [], 'club' => []];
        foreach (self::KINDS as $kind => $table) {
            try {
                $rows = $pdo->query(
                    "SELECT " . self::ID_COLUMN[$kind] . " AS id, tier, features, limits, note, updated_by, updated_at FROM {$table}"
                )->fetchAll();
            } catch (PDOException $e) {
                // 42S02: the table isn't there yet (before the SQL).
                if ($e->getCode() !== '42S02') {
                    throw $e;
                }
                continue;
            }
            foreach ($rows as $row) {
                $features = json_decode((string) $row['features'], true);
                $limits = json_decode((string) $row['limits'], true);
                self::$rows[$kind][(string) $row['id']] = [
                    'tier'       => Tiers::valid($row['tier']) ? $row['tier'] : null,
                    'features'   => is_array($features) ? array_filter($features, 'is_bool') : [],
                    'limits'     => is_array($limits) ? $limits : [],
                    'note'       => $row['note'],
                    'updated_by' => $row['updated_by'],
                    'updated_at' => $row['updated_at'],
                ];
            }
        }
        return self::$rows;
    }
}
