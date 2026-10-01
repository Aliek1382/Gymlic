<?php
declare(strict_types=1);

namespace Gymlic;

use PDO;
use Throwable;

/**
 * Who may do what in /admin. Two kinds of admin:
 *
 *   - super: profiles.is_platform_admin = 1. Everything, including what no
 *     role can be given (SUPER_ONLY below).
 *   - staff: profiles.admin_role_id points at an admin_roles row; only the
 *     permissions listed on that role.
 *
 * Checked on every admin request from the database, so a role change or a
 * revoked role takes effect on the very next request. Before
 * security-update.sql has run there is no admin_role_id column and only
 * super admins exist — exactly the behaviour before roles.
 */
final class AdminAccess
{
    /** The permissions a role can be given: key => [label, what it covers]. */
    public const PERMISSIONS = [
        'users.view'    => ['مشاهدهٔ کاربران', 'دیدن باشگاه‌ها، مربی‌ها، ورزشکاران و فهرست همهٔ کاربران.'],
        'users.manage'  => ['مدیریت کاربران', 'مسدودسازی، ویرایش پروفایل، تغییر نقش، تعیین رمز، خارج‌کردن از دستگاه‌ها، و تأیید/تعلیق باشگاه. حساب مدیران را نمی‌تواند تغییر دهد.'],
        'finance'       => ['مالی', 'درخواست‌های پرداخت، پلن‌ها و گزارش مالی.'],
        'content'       => ['محتوا', 'کتابخانه‌های حرکات، غذاها و مکمل‌ها، امتیاز مربیان، و صفحه‌های متنی (قوانین، راهنما و…).'],
        'notifications' => ['اعلان همگانی', 'ارسال اعلان به گروه‌های کاربران (با پیامک و ایمیل و زمان‌بندی) و ویرایش متن اعلان‌های خودکار.'],
        'support'       => ['پشتیبانی', 'دیدن و پاسخ‌دادن به تیکت‌های پشتیبانی کاربران.'],
        'settings'      => ['تنظیمات سایت', 'مدیریت بخش‌ها، حالت تعمیر، ثبت‌نام، اطلاعیه، پشتیبانی و محدودیت‌ها (بدون کلیدهای پیامک و ایمیل).'],
        'system'        => ['سیستم', 'سلامت سایت و صف پیامک و ایمیل.'],
        'activity'      => ['لاگ فعالیت', 'دیدن کارهایی که مدیران در پنل انجام داده‌اند.'],
    ];

    /**
     * What only a super admin can do, whatever a role says: roles and admin
     * access themselves, security, the SMS/email credentials, database
     * updates and backups (which carry every password hash and key).
     */
    public const SUPER = 'super';

    /** @var array<string, ?array> per-request cache by user id */
    private static array $cache = [];

    private function __construct()
    {
    }

    /**
     * The admin's level and permissions, or null for a regular user.
     *
     * @return array{level: string, role_id: ?string, role_name: ?string, permissions: string[]}|null
     */
    public static function of(array $user): ?array
    {
        $id = (string) $user['id'];
        if (array_key_exists($id, self::$cache)) {
            return self::$cache[$id];
        }

        if ((int) $user['is_platform_admin'] === 1) {
            return self::$cache[$id] = [
                'level'       => 'super',
                'role_id'     => null,
                'role_name'   => null,
                'permissions' => array_keys(self::PERMISSIONS),
            ];
        }

        $roleId = $user['admin_role_id'] ?? null;
        if ($roleId === null || $roleId === '') {
            return self::$cache[$id] = null;
        }

        try {
            $stmt = Database::connection()->prepare('SELECT name, permissions FROM admin_roles WHERE id = :id');
            $stmt->execute(['id' => $roleId]);
            $role = $stmt->fetch();
        } catch (Throwable $e) {
            $role = false;
        }
        if ($role === false) {
            return self::$cache[$id] = null;
        }

        return self::$cache[$id] = [
            'level'       => 'staff',
            'role_id'     => (string) $roleId,
            'role_name'   => (string) $role['name'],
            'permissions' => self::normalize(json_decode((string) $role['permissions'], true)),
        ];
    }

    /** Whether this user may do something needing $permission (or SUPER). */
    public static function can(array $user, string $permission): bool
    {
        $access = self::of($user);
        if ($access === null) {
            return false;
        }
        if ($access['level'] === 'super') {
            return true;
        }
        if ($permission === self::SUPER) {
            return false;
        }
        return in_array($permission, $access['permissions'], true);
    }

    /** Whether an account is any kind of admin — what only a super admin may change. */
    public static function isAdminAccount(array $target): bool
    {
        return (int) ($target['is_platform_admin'] ?? 0) === 1
            || (($target['admin_role_id'] ?? null) !== null && $target['admin_role_id'] !== '');
    }

    /**
     * Known keys only, deduplicated; managing users implies seeing them.
     *
     * @return string[]
     */
    public static function normalize(mixed $permissions): array
    {
        $out = [];
        foreach (is_array($permissions) ? $permissions : [] as $permission) {
            if (is_string($permission) && isset(self::PERMISSIONS[$permission])) {
                $out[$permission] = true;
            }
        }
        if (isset($out['users.manage'])) {
            $out['users.view'] = true;
        }
        return array_values(array_filter(array_keys(self::PERMISSIONS), static fn (string $k): bool => isset($out[$k])));
    }

    /**
     * The ids of every active admin who has $permission: super admins, and
     * staff whose role grants it. For telling the right people about
     * something that waits on them (a new support ticket).
     *
     * @return list<string>
     */
    public static function holders(PDO $pdo, string $permission): array
    {
        $ids = $pdo->query('SELECT id FROM profiles WHERE is_platform_admin = 1 AND is_suspended = 0')->fetchAll(PDO::FETCH_COLUMN);

        if (self::rolesReady()) {
            $rows = $pdo->query(
                'SELECT p.id, r.permissions FROM profiles p
                 JOIN admin_roles r ON r.id = p.admin_role_id
                 WHERE p.is_platform_admin = 0 AND p.is_suspended = 0'
            )->fetchAll();
            foreach ($rows as $row) {
                if (in_array($permission, self::normalize(json_decode((string) $row['permissions'], true)), true)) {
                    $ids[] = $row['id'];
                }
            }
        }

        return array_values(array_unique(array_map('strval', $ids)));
    }

    /** @return list<array{key: string, label: string, description: string}> */
    public static function catalog(): array
    {
        $out = [];
        foreach (self::PERMISSIONS as $key => [$label, $description]) {
            $out[] = ['key' => $key, 'label' => $label, 'description' => $description];
        }
        return $out;
    }

    /** Whether roles exist yet (security-update.sql has run). */
    public static function rolesReady(): bool
    {
        return Database::hasColumn('profiles', 'admin_role_id');
    }
}
