<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Auth;
use Gymlic\Cast;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Validate;

/**
 * Every account on the platform, including club owners and people who signed
 * up but never picked a role (neither appears on the per-role admin pages),
 * with the account-level actions only a platform admin has: changing the
 * role, granting admin access and setting a new password.
 */
final class AdminUsersController
{
    private const LIST_LIMIT = 300;

    private const ROLES = ['club', 'trainer', 'athlete'];

    /** ?q= name/email/phone; ?filter= club|trainer|athlete|none|admin|suspended */
    public static function list(): void
    {
        Auth::requirePlatformAdmin();

        $where = [];
        $bind = [];

        $filter = (string) ($_GET['filter'] ?? '');
        if (in_array($filter, self::ROLES, true)) {
            $where[] = 'p.account_type = :role';
            $bind['role'] = $filter;
        } elseif ($filter === 'none') {
            $where[] = 'p.account_type IS NULL';
        } elseif ($filter === 'admin') {
            $where[] = 'p.is_platform_admin = 1';
        } elseif ($filter === 'suspended') {
            $where[] = 'p.is_suspended = 1';
        }

        $q = trim((string) ($_GET['q'] ?? ''));
        if ($q !== '') {
            // Native prepares: every placeholder must be distinct.
            $where[] = "(CONCAT_WS(' ', p.first_name, p.last_name) LIKE :q1 OR p.email LIKE :q2 OR p.phone LIKE :q3)";
            $bind['q1'] = $bind['q2'] = $bind['q3'] = '%' . $q . '%';
        }

        $stmt = Database::connection()->prepare(
            'SELECT p.id, p.first_name, p.last_name, p.email, p.phone, p.account_type, p.avatar_url,
                    p.is_suspended, p.is_platform_admin, p.created_at,
                    (SELECT MAX(s.created_at) FROM sessions s WHERE s.user_id = p.id) AS last_login_at,
                    ' . self::linkCountSql('p.id') . ' AS link_count
             FROM profiles p'
            . ($where !== [] ? ' WHERE ' . implode(' AND ', $where) : '') . '
             ORDER BY p.created_at DESC
             LIMIT ' . self::LIST_LIMIT
        );
        $stmt->execute($bind);

        Response::ok([
            'items' => Cast::rows($stmt->fetchAll(), [], ['link_count'], ['is_suspended', 'is_platform_admin']),
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
        $admin = Auth::requirePlatformAdmin();
        $data = Validate::body();
        $role = $data['account_type'] ?? null;

        if ($role !== null && !in_array($role, self::ROLES, true)) {
            Response::error(400, 'invalid_role', 'نقش باید باشگاه، مربی، ورزشکار یا خالی باشد.');
            return;
        }

        $user = self::find($params['id']);
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

    public static function setAdmin(array $params): void
    {
        $admin = Auth::requirePlatformAdmin();
        $data = Validate::body();
        $isAdmin = !empty($data['is_admin']);
        $user = self::find($params['id']);

        // There is always at least the admin doing this left.
        if (!$isAdmin && $user['id'] === $admin['id']) {
            Response::error(409, 'self', 'نمی‌توانید دسترسی مدیریت خودتان را بردارید.');
            return;
        }

        $pdo = Database::connection();
        $pdo->prepare('UPDATE profiles SET is_platform_admin = :is_admin WHERE id = :id')
            ->execute(['is_admin' => $isAdmin ? 1 : 0, 'id' => $user['id']]);

        AdminController::logActivity($pdo, null, $admin['id'], $user['id'], $isAdmin ? 'admin_granted' : 'admin_revoked', []);

        Response::ok(['ok' => true]);
    }

    /** A new password for someone locked out; signs them out everywhere. */
    public static function setPassword(array $params): void
    {
        $admin = Auth::requirePlatformAdmin();
        $data = Validate::required(Validate::body(), ['password']);
        $password = (string) $data['password'];
        $user = self::find($params['id']);

        if ($user['id'] === $admin['id']) {
            Response::error(409, 'self', 'رمز خودتان را از «تنظیمات حساب» عوض کنید.');
            return;
        }
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

    private static function find(string $id): array
    {
        $stmt = Database::connection()->prepare('SELECT id, account_type FROM profiles WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if ($row === false) {
            Response::error(404, 'not_found', 'این کاربر پیدا نشد.');
            exit;
        }
        return $row;
    }
}
