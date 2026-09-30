<?php
declare(strict_types=1);

namespace Gymlic;

use Throwable;

/**
 * What the platform admin changes from /admin instead of from code: one JSON
 * value per group in `app_settings`, always read through normalize() so every
 * caller sees the full shape with defaults filled in.
 *
 * A missing row is that group's defaults, and so is a missing table: the
 * backend can reach the host before its SQL has been run and still behave
 * exactly as it did before settings existed. Only saving needs the table.
 */
final class Settings
{
    public const ROLES = ['club', 'trainer', 'athlete'];

    public const KEYS = ['maintenance', 'signup', 'announcement', 'support', 'features'];

    /** The groups any visitor may read; everything else is admin-only. */
    public const PUBLIC_KEYS = ['maintenance', 'signup', 'announcement', 'support', 'features'];

    private const ANNOUNCEMENT_TONES = ['info', 'warning', 'success'];

    /** @var array<string, mixed>|null raw decoded rows, loaded once per request */
    private static ?array $stored = null;

    private static bool $tableReady = false;

    private function __construct()
    {
    }

    public static function get(string $key): array
    {
        return self::normalize($key, self::load()[$key] ?? []);
    }

    /** False until app-settings-update.sql has been run on this database. */
    public static function storageReady(): bool
    {
        self::load();
        return self::$tableReady;
    }

    /**
     * Normalizes and stores one group, returning what was stored. Throws if
     * the table does not exist yet; the caller turns that into a message.
     */
    public static function save(string $key, mixed $value, string $adminId): array
    {
        $normalized = self::normalize($key, $value);

        Database::connection()->prepare(
            'INSERT INTO app_settings (setting_key, value, updated_by)
             VALUES (:key, :value, :updated_by)
             ON DUPLICATE KEY UPDATE value = VALUES(value), updated_by = VALUES(updated_by)'
        )->execute([
            'key'        => $key,
            'value'      => json_encode($normalized, JSON_UNESCAPED_UNICODE),
            'updated_by' => $adminId,
        ]);

        self::$stored = null;

        return $normalized;
    }

    /** @return array<string, mixed> */
    private static function load(): array
    {
        if (self::$stored !== null) {
            return self::$stored;
        }

        self::$stored = [];
        try {
            $rows = Database::connection()->query('SELECT setting_key, value FROM app_settings')->fetchAll();
            self::$tableReady = true;
            foreach ($rows as $row) {
                $decoded = json_decode((string) $row['value'], true);
                if (is_array($decoded)) {
                    self::$stored[$row['setting_key']] = $decoded;
                }
            }
        } catch (Throwable $e) {
            // Table not created yet (or the database is down, which the
            // endpoint itself will report): run on defaults.
            self::$tableReady = false;
        }

        return self::$stored;
    }

    /**
     * The full, typed shape of one group. Unknown fields are dropped and
     * anything malformed falls back to its default, so a hand-edited row in
     * phpMyAdmin can never take a page down.
     */
    public static function normalize(string $key, mixed $value): array
    {
        $v = is_array($value) ? $value : [];

        return match ($key) {
            'maintenance' => [
                'enabled' => self::bool($v['enabled'] ?? null, false),
                'message' => self::text($v['message'] ?? null, 1000),
            ],
            'signup' => [
                'open'  => self::bool($v['open'] ?? null, true),
                'roles' => self::roles($v['roles'] ?? null, self::ROLES),
            ],
            'announcement' => [
                'enabled' => self::bool($v['enabled'] ?? null, false),
                'message' => self::text($v['message'] ?? null, 1000),
                'tone'    => in_array($v['tone'] ?? null, self::ANNOUNCEMENT_TONES, true) ? $v['tone'] : 'info',
                'roles'   => self::roles($v['roles'] ?? null, self::ROLES),
            ],
            'support' => [
                'phone'    => self::text($v['phone'] ?? null, 30),
                'email'    => self::text($v['email'] ?? null, 150),
                'telegram' => self::text($v['telegram'] ?? null, 100),
                'whatsapp' => self::text($v['whatsapp'] ?? null, 30),
                'hours'    => self::text($v['hours'] ?? null, 200),
            ],
            'features' => self::features($v),
            default => throw new \InvalidArgumentException("Unknown settings key: {$key}"),
        };
    }

    /** Every feature in the catalogue, on unless the admin switched it off. */
    private static function features(array $v): array
    {
        $out = [];
        foreach (Features::CATALOG as $feature => $meta) {
            $entry = is_array($v[$feature] ?? null) ? $v[$feature] : [];
            $out[$feature] = [
                'enabled' => self::bool($entry['enabled'] ?? null, true),
                'roles'   => self::roles($entry['roles'] ?? null, $meta['roles']),
            ];
        }
        return $out;
    }

    /** @param string[] $allowed */
    private static function roles(mixed $value, array $allowed): array
    {
        $v = is_array($value) ? $value : [];
        $out = [];
        foreach ($allowed as $role) {
            $out[$role] = self::bool($v[$role] ?? null, true);
        }
        return $out;
    }

    private static function bool(mixed $value, bool $default): bool
    {
        if (is_bool($value)) {
            return $value;
        }
        if ($value === 1 || $value === '1' || $value === 'true') {
            return true;
        }
        if ($value === 0 || $value === '0' || $value === 'false') {
            return false;
        }
        return $default;
    }

    private static function text(mixed $value, int $max): string
    {
        if (!is_string($value) && !is_int($value) && !is_float($value)) {
            return '';
        }
        return mb_substr(trim((string) $value), 0, $max);
    }
}
