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

    public const KEYS = [
        'maintenance', 'signup', 'announcement', 'support', 'features', 'points_levels', 'limits', 'sms', 'mail', 'security', 'billing', 'templates', 'branding',
    ];

    /** The groups any visitor may read; everything else is admin-only. */
    public const PUBLIC_KEYS = ['maintenance', 'signup', 'announcement', 'support', 'features', 'limits', 'branding'];

    /**
     * Fields that are credentials: never sent back to the browser (the admin
     * screen gets a masked hint instead), and kept as they are when a save
     * leaves them empty. See SettingsController.
     */
    public const SECRETS = ['sms' => ['api_key'], 'mail' => ['smtp_pass']];

    public const ATTACHMENT_TYPES = ['voice', 'image', 'video', 'file'];

    /** messages.body is VARCHAR(1000): the limit can be lowered, not raised. */
    public const MESSAGE_MAX_CHARS = 1000;

    private const DEFAULT_UPLOAD_MB = ['voice' => 8, 'image' => 8, 'video' => 50, 'file' => 8];

    private const ANNOUNCEMENT_TONES = ['info', 'warning', 'success'];

    /** Coach levels before the admin edits them (what PointsService used to hard-code). */
    public const DEFAULT_POINT_LEVELS = [
        ['name' => 'تازه‌کار', 'min_points' => 0],
        ['name' => 'مربی فعال', 'min_points' => 100],
        ['name' => 'مربی حرفه‌ای', 'min_points' => 500],
        ['name' => 'مربی برتر', 'min_points' => 2000],
    ];

    private const MAX_POINT_LEVELS = 20;

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
            'points_levels' => ['levels' => self::pointLevels($v['levels'] ?? null)],
            'limits' => [
                'message_max_chars' => self::int($v['message_max_chars'] ?? null, self::MESSAGE_MAX_CHARS, 50, self::MESSAGE_MAX_CHARS),
                'attachments'       => self::switches($v['attachments'] ?? null, self::ATTACHMENT_TYPES),
                'upload_mb'         => self::uploadMb($v['upload_mb'] ?? null),
            ],
            // See Security. admin_2fa is only switched on through its own flow.
            'security' => [
                'max_attempts'    => self::int($v['max_attempts'] ?? null, 5, 3, 20),
                'lock_minutes'    => self::int($v['lock_minutes'] ?? null, 15, 1, 1440),
                'ip_max_attempts' => self::int($v['ip_max_attempts'] ?? null, 30, 10, 1000),
                'admin_2fa'       => self::bool($v['admin_2fa'] ?? null, false),
            ],
            // Where clubs pay for their subscription, shown in their payment
            // dialog (BillingController::info), and when a subscription
            // counts as running out. Card and IBAN are kept as digits only.
            'billing' => [
                'card_number'    => self::digits($v['card_number'] ?? null, 19),
                'sheba'          => self::sheba($v['sheba'] ?? null),
                'account_holder' => self::text($v['account_holder'] ?? null, 100),
                'bank_name'      => self::text($v['bank_name'] ?? null, 60),
                'instructions'   => self::text($v['instructions'] ?? null, 1000),
                'expiring_days'  => self::int($v['expiring_days'] ?? null, 7, 1, 60),
                // Payment receipts (see Receipts): whether the image/PDF is
                // mandatory, the size ceiling after the browser has shrunk
                // it, and how many days after review the file is deleted
                // (0 = keep). The tracking code and last four card digits
                // are always required.
                'receipt_required'       => self::bool($v['receipt_required'] ?? null, true),
                'receipt_max_mb'         => self::int($v['receipt_max_mb'] ?? null, 3, 1, 10),
                'receipt_retention_days' => self::int($v['receipt_retention_days'] ?? null, 7, 0, 365),
                // Trainer subscriptions (TrainerBilling): when on, a trainer
                // working outside a club needs an active plan, within its
                // athlete cap, to invite new athletes. Off until the admin
                // has set the plans up.
                'trainer_enforce'        => self::bool($v['trainer_enforce'] ?? null, false),
            ],
            // Notification texts; see Templates.
            'templates' => Templates::normalize($v),
            // The name, main color and logo the panel shows; empty = Gymlic's
            // own. The logo is only set by BrandingController's upload.
            'branding' => [
                'app_name'      => self::text($v['app_name'] ?? null, 40),
                'primary_color' => is_string($v['primary_color'] ?? null) && preg_match('/^#[0-9a-f]{6}$/i', $v['primary_color']) === 1
                    ? strtolower($v['primary_color'])
                    : '',
                'logo_url'      => is_string($v['logo_url'] ?? null) && preg_match('#^https?://[^\s<>"\'()]+$#i', $v['logo_url']) === 1
                    && strlen($v['logo_url']) <= 1024
                    ? $v['logo_url']
                    : '',
            ],
            // Empty = fall back to config.php (see SmsGateway / MailGateway).
            'sms' => [
                'api_key' => self::text($v['api_key'] ?? null, 200),
                'sender'  => self::text($v['sender'] ?? null, 30),
            ],
            'mail' => [
                'from_address' => self::text($v['from_address'] ?? null, 150),
                'from_name'    => self::text($v['from_name'] ?? null, 100),
                'smtp_host'    => self::text($v['smtp_host'] ?? null, 150),
                'smtp_port'    => self::int($v['smtp_port'] ?? null, 465, 1, 65535),
                'smtp_secure'  => in_array($v['smtp_secure'] ?? null, ['ssl', 'tls'], true) ? $v['smtp_secure'] : 'ssl',
                'smtp_user'    => self::text($v['smtp_user'] ?? null, 150),
                'smtp_pass'    => self::text($v['smtp_pass'] ?? null, 200),
            ],
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

    /**
     * Levels sorted by threshold, the lowest always starting at 0 (every coach
     * must be on some level), no two sharing a threshold, none unnamed.
     */
    private static function pointLevels(mixed $value): array
    {
        if (!is_array($value)) {
            return self::DEFAULT_POINT_LEVELS;
        }

        $levels = [];
        foreach ($value as $level) {
            if (!is_array($level)) {
                continue;
            }
            $name = self::text($level['name'] ?? null, 50);
            $min = $level['min_points'] ?? null;
            if ($name === '' || !is_numeric($min)) {
                continue;
            }
            $levels[] = ['name' => $name, 'min_points' => max(0, min(100_000_000, (int) $min))];
        }

        usort($levels, static fn (array $a, array $b): int => $a['min_points'] <=> $b['min_points']);

        $unique = [];
        foreach ($levels as $level) {
            if (!isset($unique[$level['min_points']])) {
                $unique[$level['min_points']] = $level;
            }
        }
        $levels = array_slice(array_values($unique), 0, self::MAX_POINT_LEVELS);

        if ($levels === []) {
            return self::DEFAULT_POINT_LEVELS;
        }
        $levels[0]['min_points'] = 0;
        return $levels;
    }

    private static function uploadMb(mixed $value): array
    {
        $v = is_array($value) ? $value : [];
        $out = [];
        foreach (self::DEFAULT_UPLOAD_MB as $type => $default) {
            $out[$type] = self::int($v[$type] ?? null, $default, 1, 200);
        }
        return $out;
    }

    /** @param string[] $names */
    private static function switches(mixed $value, array $names): array
    {
        $v = is_array($value) ? $value : [];
        $out = [];
        foreach ($names as $name) {
            $out[$name] = self::bool($v[$name] ?? null, true);
        }
        return $out;
    }

    private static function int(mixed $value, int $default, int $min, int $max): int
    {
        if (!is_numeric($value)) {
            return $default;
        }
        return max($min, min($max, (int) $value));
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

    /** Latin digits only (Persian ones converted, spaces and dashes dropped). */
    public static function digits(mixed $value, int $max): string
    {
        $text = strtr(self::text($value, 100), [
            '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
            '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
        ]);
        return substr(preg_replace('/\D+/', '', $text) ?? '', 0, $max);
    }

    /** "IR" + the 24 digits, whether or not the admin typed the IR. */
    private static function sheba(mixed $value): string
    {
        $digits = self::digits($value, 24);
        return $digits === '' ? '' : 'IR' . $digits;
    }

    private static function text(mixed $value, int $max): string
    {
        if (!is_string($value) && !is_int($value) && !is_float($value)) {
            return '';
        }
        return mb_substr(trim((string) $value), 0, $max);
    }
}
