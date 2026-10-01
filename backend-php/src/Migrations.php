<?php
declare(strict_types=1);

namespace Gymlic;

use PDO;
use PDOException;
use Throwable;

/**
 * The database changes the admin runs from /admin/database instead of
 * pasting them into phpMyAdmin. Each one is a reviewed file in schema/
 * (shipped with the backend), never SQL typed into the panel, plus a check
 * that says whether its change is already in the database — so a change the
 * owner ran by hand before this existed shows as done and is never run again.
 *
 * Adding a schema change = a new schema/*-update.sql file + an entry at the
 * end of LIST. The PR still carries the SQL, for phpMyAdmin as a fallback.
 */
final class Migrations
{
    /**
     * check: every condition must hold for the change to count as applied.
     *   ['table', name] | ['column', table, column] | ['scale', table, column, decimals]
     *   | ['preset', table, name_en] (a shared-library row with that English name exists)
     *   | ['described', table, name_en] (that row has a non-empty description)
     *
     * @var list<array{id: string, file: string, title: string, check: list<array>}>
     */
    public const LIST = [
        [
            'id'    => 'notification-channels',
            'file'  => 'notification-channels-update.sql',
            'title' => 'ارسال اعلان‌ها با پیامک و ایمیل',
            'check' => [['column', 'profiles', 'notify_sms'], ['table', 'notification_deliveries']],
        ],
        [
            'id'    => 'chat-media-archive',
            'file'  => 'chat-media-archive-update.sql',
            'title' => 'پیوست در پیام‌ها و بایگانی گفتگو',
            'check' => [['column', 'messages', 'media_url'], ['table', 'conversation_archives']],
        ],
        [
            'id'    => 'trainer-payment-method',
            'file'  => 'trainer-payment-method-update.sql',
            'title' => 'روش پرداخت در درآمد مربی',
            'check' => [['column', 'trainer_payments', 'payment_method']],
        ],
        [
            'id'    => 'trainer-profiles',
            'file'  => 'trainer-profiles-update.sql',
            'title' => 'رزومهٔ مربی',
            'check' => [['table', 'trainer_profiles']],
        ],
        [
            'id'    => 'notes',
            'file'  => 'notes-update.sql',
            'title' => 'یادداشت‌های مربی',
            'check' => [['table', 'notes']],
        ],
        [
            'id'    => 'supplements',
            'file'  => 'supplements-update.sql',
            'title' => 'مکمل‌ها',
            'check' => [['table', 'supplements'], ['table', 'supplement_plan_items']],
        ],
        [
            'id'    => 'questionnaires',
            'file'  => 'questionnaires-update.sql',
            'title' => 'پرسشنامه‌ها',
            'check' => [['table', 'questionnaires'], ['table', 'questionnaire_answers']],
        ],
        [
            'id'    => 'techniques',
            'file'  => 'techniques-update.sql',
            'title' => 'تکنیک‌های تمرینی',
            'check' => [['table', 'techniques'], ['column', 'workout_plan_exercises', 'technique_id']],
        ],
        [
            'id'    => 'foods-macros',
            'file'  => 'foods-macros-update.sql',
            'title' => 'ارزش غذایی دقیق غذاها',
            'check' => [['scale', 'foods', 'calories_per_unit', 4]],
        ],
        [
            'id'    => 'assessment-reminders',
            'file'  => 'assessment-reminders-update.sql',
            'title' => 'یادآور ارزیابی دوره‌ای',
            'check' => [['table', 'assessment_reminders']],
        ],
        [
            'id'    => 'points',
            'file'  => 'points-update.sql',
            'title' => 'امتیاز مربیان',
            'check' => [['table', 'point_rules'], ['table', 'coach_point_logs']],
        ],
        [
            'id'    => 'app-settings',
            'file'  => 'app-settings-update.sql',
            'title' => 'تنظیمات سایت از پنل مدیریت (فاز ۱)',
            'check' => [['table', 'app_settings']],
        ],
        [
            'id'    => 'library-hidden',
            'file'  => 'library-hidden-update.sql',
            'title' => 'پنهان‌کردن موارد کتابخانه (فاز ۲)',
            'check' => [
                ['column', 'exercises', 'is_hidden'],
                ['column', 'foods', 'is_hidden'],
                ['column', 'supplements', 'is_hidden'],
            ],
        ],
        [
            'id'    => 'security',
            'file'  => 'security-update.sql',
            'title' => 'نقش‌های مدیریتی، قفل ورود و ورود دومرحله‌ای (فاز ۵)',
            'check' => [
                ['table', 'admin_roles'],
                ['column', 'profiles', 'admin_role_id'],
                ['table', 'login_attempts'],
                ['table', 'login_challenges'],
            ],
        ],
        [
            'id'    => 'finance',
            'file'  => 'finance-update.sql',
            'title' => 'کد تخفیف اشتراک (فاز ۶)',
            'check' => [
                ['table', 'discount_codes'],
                ['column', 'payment_requests', 'discount_code_id'],
                ['column', 'payment_requests', 'list_price_toman'],
                ['column', 'payment_requests', 'discount_toman'],
            ],
        ],
        [
            'id'    => 'communication',
            'file'  => 'communication-update.sql',
            'title' => 'اعلان همگانی، تیکت پشتیبانی و صفحه‌های متنی (فاز ۷)',
            'check' => [
                ['table', 'broadcasts'],
                ['table', 'support_tickets'],
                ['column', 'support_messages', 'seq'],
                ['table', 'site_pages'],
                ['column', 'profiles', 'last_seen_at'],
            ],
        ],
        [
            'id'    => 'content',
            'file'  => 'content-update.sql',
            'title' => 'محتوای آماده برای مربی‌ها و عکس و ویدیوی حرکات (فاز ۸)',
            'check' => [
                ['column', 'workout_assignments', 'is_public'],
                ['column', 'nutrition_assignments', 'is_public'],
                ['column', 'techniques', 'is_public'],
                ['column', 'questionnaires', 'is_public'],
                ['column', 'exercises', 'image_url'],
                ['column', 'exercises', 'video_url'],
            ],
        ],
        [
            'id'    => 'library-extra',
            'file'  => 'library-extra-update.sql',
            'title' => '۵۰ حرکت، ۵۰ غذا و ۲۰ مکمل جدید در بانک عمومی',
            'check' => [
                ['preset', 'exercises', 'Decline Barbell Bench Press'],
                ['preset', 'exercises', 'Power Clean'],
                ['preset', 'foods', 'Cooked Lean Ground Beef'],
                ['preset', 'foods', 'Air-Popped Popcorn'],
                ['preset', 'supplements', 'Whey Isolate'],
                ['preset', 'supplements', 'Rhodiola Rosea'],
            ],
        ],
        [
            'id'    => 'library-descriptions',
            'file'  => 'library-descriptions-update.sql',
            'title' => 'توضیح برای حرکات و غذاهای آمادهٔ قبلی',
            'check' => [
                ['described', 'exercises', 'Barbell Bench Press'],
                ['described', 'exercises', 'Elliptical Trainer'],
                ['described', 'foods', 'Chicken Breast'],
                ['described', 'foods', 'Fresh Fruit Juice'],
            ],
        ],
        [
            'id'    => 'analytics',
            'file'  => 'analytics-update.sql',
            'title' => 'آمار رشد و نمایش پنل کاربر برای پشتیبانی (فاز ۹)',
            'check' => [
                ['table', 'daily_active'],
                ['column', 'sessions', 'impersonated_by'],
                ['column', 'sessions', 'read_only'],
            ],
        ],
    ];

    /**
     * "Already there" errors. Each statement is atomic, so one of these means
     * that statement ran before (by hand, or in a run that later failed) —
     * skipping it is what lets a half-finished run simply be run again.
     * 1050 table exists · 1060 duplicate column · 1061 duplicate key name ·
     * 1062 duplicate row · 1022/1826 duplicate foreign key.
     */
    private const ALREADY_DONE = [1050, 1060, 1061, 1062, 1022, 1826];

    private function __construct()
    {
    }

    /**
     * Every change with its state: 'applied' (its change is in the database)
     * or 'pending'. ran_at/ran_by say whether it was run from this panel.
     *
     * @return list<array<string, mixed>>
     */
    public static function status(): array
    {
        $pdo = Database::connection();
        $log = self::log($pdo);

        $out = [];
        foreach (self::LIST as $migration) {
            $applied = self::isApplied($pdo, $migration);
            $ran = $log[$migration['id']] ?? null;
            $out[] = [
                'id'          => $migration['id'],
                'title'       => $migration['title'],
                'file'        => $migration['file'],
                'state'       => $applied ? 'applied' : 'pending',
                'ran_at'      => $ran['applied_at'] ?? null,
                'ran_by_name' => $ran['ran_by_name'] ?? null,
                'file_found'  => is_file(self::path($migration['file'])),
                'statements'  => is_file(self::path($migration['file']))
                    ? count(SqlScript::split((string) file_get_contents(self::path($migration['file']))))
                    : 0,
            ];
        }
        return $out;
    }

    /**
     * Runs one change. Statements that are already in place are skipped;
     * anything else that fails stops the run there and is reported.
     *
     * @return array{ok: bool, executed: int, skipped: int, error: ?string, failed_statement: ?string}
     */
    public static function run(string $id, string $adminId): array
    {
        $migration = self::find($id);
        $pdo = Database::connection();

        // Only what isn't in the database yet. An update file isn't promised
        // to be safe to run twice (an INSERT without a guard would duplicate).
        if (self::isApplied($pdo, $migration)) {
            return self::result(false, 0, 0, 'این به‌روزرسانی قبلاً روی دیتابیس انجام شده است و دوباره اجرا نمی‌شود.');
        }

        // One run at a time, even if the button is pressed in two tabs.
        $lock = self::scalar($pdo, "SELECT GET_LOCK('gymlic_migrations', 0)");
        if ((int) $lock !== 1) {
            return self::result(false, 0, 0, 'یک به‌روزرسانی دیگر همین حالا در حال اجراست. چند ثانیه بعد دوباره امتحان کنید.');
        }

        try {
            $sql = @file_get_contents(self::path($migration['file']));
            if ($sql === false) {
                return self::result(false, 0, 0, "فایل {$migration['file']} روی هاست پیدا نشد. بک‌اند را دوباره آپلود کنید.");
            }

            $executed = 0;
            $skipped = 0;
            foreach (SqlScript::split($sql) as $statement) {
                try {
                    // query(), not exec(): some files end with a SELECT that
                    // checks the result, and an unread result set blocks the
                    // next statement (MySQL error 2014).
                    $stmt = $pdo->query($statement);
                    $stmt->closeCursor();
                    $executed++;
                } catch (PDOException $e) {
                    $code = (int) ($e->errorInfo[1] ?? 0);
                    if (in_array($code, self::ALREADY_DONE, true)) {
                        $skipped++;
                        continue;
                    }
                    return self::result(false, $executed, $skipped, $e->getMessage(), mb_substr($statement, 0, 500));
                }
            }

            if (!self::isApplied($pdo, $migration)) {
                return self::result(
                    false,
                    $executed,
                    $skipped,
                    'دستورها اجرا شدند، ولی تغییر مورد انتظار در دیتابیس دیده نمی‌شود. قبل از هر کار دیگری با پشتیبانی فنی بررسی کنید.'
                );
            }

            self::ensureLogTable($pdo);
            $pdo->prepare(
                'INSERT INTO schema_migrations (id, applied_at, applied_by) VALUES (:id, NOW(), :by)
                 ON DUPLICATE KEY UPDATE applied_at = NOW(), applied_by = VALUES(applied_by)'
            )->execute(['id' => $id, 'by' => $adminId]);

            return self::result(true, $executed, $skipped, null);
        } finally {
            self::scalar($pdo, "SELECT RELEASE_LOCK('gymlic_migrations')");
        }
    }

    private static function scalar(PDO $pdo, string $sql): mixed
    {
        $stmt = $pdo->query($sql);
        $value = $stmt->fetchColumn();
        $stmt->closeCursor();
        return $value;
    }

    public static function exists(string $id): bool
    {
        foreach (self::LIST as $migration) {
            if ($migration['id'] === $id) {
                return true;
            }
        }
        return false;
    }

    private static function find(string $id): array
    {
        foreach (self::LIST as $migration) {
            if ($migration['id'] === $id) {
                return $migration;
            }
        }
        throw new \InvalidArgumentException("Unknown migration: {$id}");
    }

    private static function isApplied(PDO $pdo, array $migration): bool
    {
        foreach ($migration['check'] as $check) {
            $ok = match ($check[0]) {
                'table'  => self::tableExists($pdo, $check[1]),
                'column' => self::columnInfo($pdo, $check[1], $check[2]) !== null,
                'scale'  => (int) (self::columnInfo($pdo, $check[1], $check[2])['NUMERIC_SCALE'] ?? -1) === $check[3],
                'preset' => self::presetExists($pdo, $check[1], $check[2]),
                'described' => self::presetExists($pdo, $check[1], $check[2], true),
                default  => false,
            };
            if (!$ok) {
                return false;
            }
        }
        return true;
    }

    private static function tableExists(PDO $pdo, string $table): bool
    {
        $stmt = $pdo->prepare(
            'SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t'
        );
        $stmt->execute(['t' => $table]);
        return $stmt->fetch() !== false;
    }

    /** $table comes from LIST, never from a request. */
    private static function presetExists(PDO $pdo, string $table, string $nameEn, bool $described = false): bool
    {
        $filled = $described ? " AND description IS NOT NULL AND description <> ''" : '';
        $stmt = $pdo->prepare("SELECT 1 FROM {$table} WHERE name_en = :n AND created_by IS NULL{$filled} LIMIT 1");
        $stmt->execute(['n' => $nameEn]);
        return $stmt->fetch() !== false;
    }

    private static function columnInfo(PDO $pdo, string $table, string $column): ?array
    {
        $stmt = $pdo->prepare(
            'SELECT NUMERIC_SCALE FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = :c'
        );
        $stmt->execute(['t' => $table, 'c' => $column]);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    /** The panel's own record of runs. Created on the first run, so reading never needs it. */
    private static function ensureLogTable(PDO $pdo): void
    {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS schema_migrations (
               id         VARCHAR(100) NOT NULL PRIMARY KEY,
               applied_at DATETIME NOT NULL,
               applied_by CHAR(36) NULL
             ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );
    }

    /** @return array<string, array{applied_at: string, ran_by_name: ?string}> */
    private static function log(PDO $pdo): array
    {
        try {
            $rows = $pdo->query(
                "SELECT m.id, m.applied_at, CONCAT_WS(' ', p.first_name, p.last_name) AS ran_by_name
                 FROM schema_migrations m
                 LEFT JOIN profiles p ON p.id = m.applied_by"
            )->fetchAll();
        } catch (Throwable $e) {
            return []; // nothing has been run from the panel yet
        }
        $out = [];
        foreach ($rows as $row) {
            $out[$row['id']] = $row;
        }
        return $out;
    }

    private static function path(string $file): string
    {
        return __DIR__ . '/../schema/' . $file;
    }

    private static function result(bool $ok, int $executed, int $skipped, ?string $error, ?string $statement = null): array
    {
        return [
            'ok'               => $ok,
            'executed'         => $executed,
            'skipped'          => $skipped,
            'error'            => $error,
            'failed_statement' => $statement,
        ];
    }
}
