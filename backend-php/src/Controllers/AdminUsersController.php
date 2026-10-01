<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\AdminAccess;
use Gymlic\Auth;
use Gymlic\Cast;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Security;
use Gymlic\SmsGateway;
use Gymlic\Validate;

/**
 * Every account on the platform, including club owners and people who signed
 * up but never picked a role (neither appears on the per-role admin pages),
 * with the account-level actions: profile edits, the role, admin access,
 * a new password and the devices an account is signed in on.
 *
 * An admin's own account can only be changed by a super admin
 * (Security::targetFor), whatever permissions a staff role carries.
 */
final class AdminUsersController
{
    private const LIST_LIMIT = 300;

    private const ROLES = ['club', 'trainer', 'athlete'];

    /** ?q= name/email/phone; ?filter= club|trainer|athlete|none|admin|suspended */
    public static function list(): void
    {
        Auth::requireAdmin('users.view');

        $where = [];
        $bind = [];

        $filter = (string) ($_GET['filter'] ?? '');
        if (in_array($filter, self::ROLES, true)) {
            $where[] = 'p.account_type = :role';
            $bind['role'] = $filter;
        } elseif ($filter === 'none') {
            $where[] = 'p.account_type IS NULL';
        } elseif ($filter === 'admin') {
            $where[] = AdminAccess::rolesReady()
                ? '(p.is_platform_admin = 1 OR p.admin_role_id IS NOT NULL)'
                : 'p.is_platform_admin = 1';
        } elseif ($filter === 'suspended') {
            $where[] = 'p.is_suspended = 1';
        }

        $q = trim((string) ($_GET['q'] ?? ''));
        if ($q !== '') {
            // Native prepares: every placeholder must be distinct.
            $where[] = "(CONCAT_WS(' ', p.first_name, p.last_name) LIKE :q1 OR p.email LIKE :q2 OR p.phone LIKE :q3)";
            $bind['q1'] = $bind['q2'] = $bind['q3'] = '%' . $q . '%';
        }

        $roles = AdminAccess::rolesReady();
        // An admin's view of the account is not the account signing in.
        $own = Auth::viewSessionsReady() ? ' AND s.impersonated_by IS NULL' : '';
        $own2 = Auth::viewSessionsReady() ? ' AND s2.impersonated_by IS NULL' : '';
        $stmt = Database::connection()->prepare(
            'SELECT p.id, p.first_name, p.last_name, p.email, p.phone, p.birth_date, p.account_type, p.avatar_url,
                    p.is_suspended, p.is_platform_admin, p.created_at,
                    ' . ($roles ? 'p.admin_role_id, r.name AS admin_role_name,' : 'NULL AS admin_role_id, NULL AS admin_role_name,') . '
                    (SELECT MAX(s.created_at) FROM sessions s WHERE s.user_id = p.id AND s.expires_at > NOW()' . $own . ') AS last_login_at,
                    (SELECT COUNT(*) FROM sessions s2 WHERE s2.user_id = p.id AND s2.expires_at > NOW()' . $own2 . ') AS session_count,
                    ' . self::linkCountSql('p.id') . ' AS link_count
             FROM profiles p'
            . ($roles ? ' LEFT JOIN admin_roles r ON r.id = p.admin_role_id' : '')
            . ($where !== [] ? ' WHERE ' . implode(' AND ', $where) : '') . '
             ORDER BY p.created_at DESC
             LIMIT ' . self::LIST_LIMIT
        );
        $stmt->execute($bind);

        Response::ok([
            'items' => Cast::rows($stmt->fetchAll(), [], ['link_count', 'session_count'], ['is_suspended', 'is_platform_admin']),
        ]);
    }

    /**
     * Only for an account with nothing tied to its role yet — typically
     * someone who picked the wrong role at sign-up. A trainer with athletes
     * or a club owner can't simply become something else: their memberships
     * and links would be left pointing at the wrong kind of account.
     * null clears the role, so the user picks again at next login.
     */
    public static function setRole(array $params): void
    {
        $admin = Auth::requireAdmin('users.manage');
        $data = Validate::body();
        $role = $data['account_type'] ?? null;

        if ($role !== null && !in_array($role, self::ROLES, true)) {
            Response::error(400, 'invalid_role', 'نقش باید باشگاه، مربی، ورزشکار یا خالی باشد.');
            return;
        }

        $user = Security::targetFor($admin, $params['id']);
        $pdo = Database::connection();

        $links = $pdo->prepare('SELECT ' . self::linkCountSql(':id1', ':id2', ':id3', ':id4') . ' AS n');
        $links->execute(['id1' => $user['id'], 'id2' => $user['id'], 'id3' => $user['id'], 'id4' => $user['id']]);
        if ((int) $links->fetchColumn() > 0) {
            Response::error(
                409,
                'has_links',
                'این حساب باشگاه، عضویت یا ارتباط مربی و ورزشکار دارد و تغییر نقشش آن‌ها را خراب می‌کند. نقش فقط برای حسابی که هنوز به جایی وصل نشده قابل تغییر است.'
            );
            return;
        }

        $pdo->prepare('UPDATE profiles SET account_type = :role WHERE id = :id')
            ->execute(['role' => $role, 'id' => $user['id']]);

        AdminController::logActivity($pdo, null, $admin['id'], $user['id'], 'user_role_changed', [
            'from' => $user['account_type'],
            'to'   => $role,
        ]);

        Response::ok(['ok' => true]);
    }

    /**
     * The account's admin access: level 'none', 'super' (everything) or
     * 'role' with role_id (that role's permissions). Older clients send
     * {is_admin: bool}, read as super/none.
     */
    public static function setAdmin(array $params): void
    {
        $admin = Auth::requireAdmin(AdminAccess::SUPER);
        $data = Validate::body();
        $level = (string) ($data['level'] ?? (!empty($data['is_admin']) ? 'super' : 'none'));
        $roleId = $level === 'role' ? (string) ($data['role_id'] ?? '') : null;
        $user = Security::targetFor($admin, $params['id']);
        $pdo = Database::connection();

        if (!in_array($level, ['none', 'super', 'role'], true)) {
            Response::error(400, 'invalid_level', 'سطح دسترسی معتبر نیست.');
            return;
        }
        // There is always at least the admin doing this left with full access.
        if ($user['id'] === $admin['id'] && $level !== 'super') {
            Response::error(409, 'self', 'نمی‌توانید دسترسی مدیریت خودتان را کم کنید.');
            return;
        }
        if ($level === 'role') {
            if (!AdminAccess::rolesReady()) {
                Response::error(503, 'schema_missing', 'نقش‌های مدیریتی هنوز فعال نیست: به‌روزرسانی دیتابیس «فاز ۵» را اجرا کنید.');
                return;
            }
            $role = $pdo->prepare('SELECT name FROM admin_roles WHERE id = :id');
            $role->execute(['id' => $roleId]);
            if ($role->fetch() === false) {
                Response::error(404, 'role_not_found', 'این نقش مدیریتی وجود ندارد.');
                return;
            }
        }
        if ($level !== 'none' && Security::settings()['admin_2fa']
            && SmsGateway::normalizePhone((string) $user['phone']) === null) {
            Response::error(409, 'admin_needs_phone', 'ورود دومرحله‌ای روشن است؛ اول برای این کاربر شمارهٔ موبایل معتبر ثبت کنید.');
            return;
        }

        $sets = 'is_platform_admin = :super' . (AdminAccess::rolesReady() ? ', admin_role_id = :role' : '');
        $bind = ['super' => $level === 'super' ? 1 : 0, 'id' => $user['id']];
        if (AdminAccess::rolesReady()) {
            $bind['role'] = $roleId;
        }
        $pdo->prepare("UPDATE profiles SET {$sets} WHERE id = :id")->execute($bind);

        AdminController::logActivity(
            $pdo,
            null,
            $admin['id'],
            $user['id'],
            $level === 'none' ? 'admin_revoked' : 'admin_granted',
            ['level' => $level, 'role_id' => $roleId]
        );

        Response::ok(['ok' => true]);
    }

    /**
     * The devices an account is signed in on. A session is identified to the
     * browser by a hash prefix of its token, never the token itself (that
     * would be the login).
     */
    public static function sessions(array $params): void
    {
        $admin = Auth::requireAdmin('users.manage');
        Security::targetFor($admin, $params['id']);

        $stmt = Database::connection()->prepare(
            'SELECT LEFT(SHA2(token, 256), 16) AS id, user_agent, ip_address, created_at, expires_at
             FROM sessions WHERE user_id = :id AND expires_at > NOW()'
            . (Auth::viewSessionsReady() ? ' AND impersonated_by IS NULL' : '') . '
             ORDER BY created_at DESC'
        );
        $stmt->execute(['id' => $params['id']]);
        $currentHash = substr(hash('sha256', self::currentToken()), 0, 16);

        $items = array_map(static function (array $row) use ($currentHash): array {
            $row['is_current'] = $row['id'] === $currentHash;
            return $row;
        }, $stmt->fetchAll());

        Response::ok(['items' => $items]);
    }

    /** Signs the account out on one device (sid) or, without one, everywhere. */
    public static function revokeSessions(array $params): void
    {
        $admin = Auth::requireAdmin('users.manage');
        Security::targetFor($admin, $params['id']);
        $pdo = Database::connection();

        $sql = 'DELETE FROM sessions WHERE user_id = :id';
        $bind = ['id' => $params['id']];
        if (isset($params['sid'])) {
            $sql .= ' AND LEFT(SHA2(token, 256), 16) = :sid';
            $bind['sid'] = $params['sid'];
        } elseif ($params['id'] === $admin['id']) {
            // Everywhere but here: signing yourself out of the page you're on helps nobody.
            $sql .= ' AND token <> :current';
            $bind['current'] = self::currentToken();
        }
        $stmt = $pdo->prepare($sql);
        $stmt->execute($bind);

        AdminController::logActivity($pdo, null, $admin['id'], $params['id'], 'sessions_revoked', [
            'count' => $stmt->rowCount(),
        ]);

        Response::ok(['count' => $stmt->rowCount()]);
    }

    /** How long a view of someone's panel lasts before it has to be opened again. */
    private const VIEW_TTL_SECONDS = 3600;

    /**
     * A read-only session on a user's account, for a super admin to see
     * their panel exactly as they do while helping them (support). Nothing
     * can be changed through it (Auth::currentUser), it is not the user
     * being active, it never shows among their devices, and it ends after an
     * hour or when the admin closes the view. Never on another admin.
     */
    public static function viewAs(array $params): void
    {
        $admin = Auth::requireAdmin(AdminAccess::SUPER);
        if (!Auth::viewSessionsReady()) {
            Response::error(
                409,
                'migration_required',
                'برای این کار ابتدا به‌روزرسانی «آمار رشد و نمایش پنل کاربر برای پشتیبانی (فاز ۹)» را از صفحهٔ «به‌روزرسانی دیتابیس» اجرا کنید.'
            );
            return;
        }
        $user = Security::targetFor($admin, $params['id']);
        if (AdminAccess::isAdminAccount($user)) {
            Response::error(409, 'admin_target', 'پنل مدیران را نمی‌شود از این راه دید.');
            return;
        }
        if ($user['account_type'] === null) {
            Response::error(409, 'no_role', 'این کاربر هنوز نقشش را انتخاب نکرده و پنلی برای دیدن ندارد.');
            return;
        }

        $pdo = Database::connection();
        $session = Auth::createViewSession($user['id'], $admin['id'], self::VIEW_TTL_SECONDS);
        AdminController::logActivity($pdo, null, $admin['id'], $user['id'], 'user_viewed_as', []);

        Response::ok($session);
    }

    private static function currentToken(): string
    {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        return preg_match('/^Bearer\s+(\S+)$/i', $header, $m) ? $m[1] : '';
    }

    /** A new password for someone locked out; signs them out everywhere. */
    public static function setPassword(array $params): void
    {
        $admin = Auth::requireAdmin('users.manage');
        $data = Validate::required(Validate::body(), ['password']);
        $password = (string) $data['password'];
        if ($params['id'] === $admin['id']) {
            Response::error(409, 'self', 'رمز خودتان را از «تنظیمات حساب» عوض کنید.');
            return;
        }
        $user = Security::targetFor($admin, $params['id']);
        if (strlen($password) < 8) {
            Response::error(400, 'weak_password', 'رمز عبور باید حداقل ۸ کاراکتر باشد.');
            return;
        }

        $pdo = Database::connection();
        $pdo->prepare('UPDATE profiles SET password_hash = :hash WHERE id = :id')
            ->execute(['hash' => Auth::hashPassword($password), 'id' => $user['id']]);
        $pdo->prepare('DELETE FROM sessions WHERE user_id = :id')->execute(['id' => $user['id']]);

        AdminController::logActivity($pdo, null, $admin['id'], $user['id'], 'password_set_by_admin', []);

        Response::ok(['ok' => true]);
    }

    /**
     * How many things hang off an account's role: clubs it owns, club
     * memberships, and trainer–athlete links on either side.
     */
    private static function linkCountSql(string $a, ?string $b = null, ?string $c = null, ?string $d = null): string
    {
        return "((SELECT COUNT(*) FROM clubs c WHERE c.owner_id = {$a})
               + (SELECT COUNT(*) FROM memberships m WHERE m.user_id = " . ($b ?? $a) . ")
               + (SELECT COUNT(*) FROM trainer_athletes ta WHERE ta.trainer_id = " . ($c ?? $a) . '
                    OR ta.athlete_id = ' . ($d ?? $a) . '))';
    }
}
