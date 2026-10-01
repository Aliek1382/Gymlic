<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\AdminAccess;
use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Uuid;
use Gymlic\Validate;
use PDOException;

/**
 * Limited admin roles: a name and a set of permissions (AdminAccess). Who
 * holds a role is set per account in /admin/users. Super admin only.
 */
final class AdminRolesController
{
    public static function list(): void
    {
        Auth::requireAdmin(AdminAccess::SUPER);

        if (!AdminAccess::rolesReady()) {
            Response::ok(['ready' => false, 'catalog' => AdminAccess::catalog(), 'roles' => []]);
            return;
        }

        $pdo = Database::connection();
        $roles = $pdo->query('SELECT id, name, permissions FROM admin_roles ORDER BY name')->fetchAll();
        $members = $pdo->query(
            "SELECT id, admin_role_id, CONCAT_WS(' ', first_name, last_name) AS name, email
             FROM profiles WHERE admin_role_id IS NOT NULL"
        )->fetchAll();

        $out = [];
        foreach ($roles as $role) {
            $out[] = [
                'id'          => $role['id'],
                'name'        => $role['name'],
                'permissions' => AdminAccess::normalize(json_decode((string) $role['permissions'], true)),
                'members'     => array_values(array_map(
                    static fn (array $m): array => ['id' => $m['id'], 'name' => trim((string) $m['name']) !== '' ? $m['name'] : $m['email']],
                    array_filter($members, static fn (array $m): bool => $m['admin_role_id'] === $role['id'])
                )),
            ];
        }

        Response::ok(['ready' => true, 'catalog' => AdminAccess::catalog(), 'roles' => $out]);
    }

    public static function create(): void
    {
        $admin = Auth::requireAdmin(AdminAccess::SUPER);
        self::requireReady();
        [$name, $permissions] = self::input(Validate::body());

        $id = Uuid::v4();
        try {
            Database::connection()->prepare('INSERT INTO admin_roles (id, name, permissions) VALUES (:id, :name, :permissions)')
                ->execute(['id' => $id, 'name' => $name, 'permissions' => json_encode($permissions)]);
        } catch (PDOException $e) {
            self::nameTaken($e);
            return;
        }

        AdminController::logActivity(Database::connection(), null, $admin['id'], null, 'admin_role_saved', ['name' => $name]);
        Response::ok(['id' => $id], 201);
    }

    public static function update(array $params): void
    {
        $admin = Auth::requireAdmin(AdminAccess::SUPER);
        self::requireReady();
        [$name, $permissions] = self::input(Validate::body());

        try {
            $stmt = Database::connection()->prepare('UPDATE admin_roles SET name = :name, permissions = :permissions WHERE id = :id');
            $stmt->execute(['name' => $name, 'permissions' => json_encode($permissions), 'id' => $params['id']]);
        } catch (PDOException $e) {
            self::nameTaken($e);
            return;
        }

        AdminController::logActivity(Database::connection(), null, $admin['id'], null, 'admin_role_saved', ['name' => $name]);
        Response::ok(['ok' => true]);
    }

    /** Only a role nobody holds: deleting a held one would silently strip people's access. */
    public static function delete(array $params): void
    {
        $admin = Auth::requireAdmin(AdminAccess::SUPER);
        self::requireReady();
        $pdo = Database::connection();

        $held = $pdo->prepare('SELECT COUNT(*) FROM profiles WHERE admin_role_id = :id');
        $held->execute(['id' => $params['id']]);
        if ((int) $held->fetchColumn() > 0) {
            Response::error(409, 'role_in_use', 'این نقش به کسانی داده شده است. اول دسترسی آن‌ها را در صفحهٔ «همهٔ کاربران» عوض کنید.');
            return;
        }

        $name = $pdo->prepare('SELECT name FROM admin_roles WHERE id = :id');
        $name->execute(['id' => $params['id']]);
        $roleName = $name->fetchColumn();

        $pdo->prepare('DELETE FROM admin_roles WHERE id = :id')->execute(['id' => $params['id']]);
        AdminController::logActivity($pdo, null, $admin['id'], null, 'admin_role_deleted', ['name' => $roleName ?: null]);
        Response::ok(['ok' => true]);
    }

    /** @return array{0: string, 1: string[]} */
    private static function input(array $data): array
    {
        $name = trim((string) ($data['name'] ?? ''));
        if ($name === '' || mb_strlen($name) > 100) {
            Response::error(400, 'invalid_name', 'نام نقش را وارد کنید (حداکثر ۱۰۰ حرف).');
            exit;
        }
        $permissions = AdminAccess::normalize($data['permissions'] ?? []);
        if ($permissions === []) {
            Response::error(400, 'no_permissions', 'دست‌کم یک دسترسی برای نقش انتخاب کنید.');
            exit;
        }
        return [$name, $permissions];
    }

    private static function requireReady(): void
    {
        if (!AdminAccess::rolesReady()) {
            Response::error(503, 'schema_missing', 'نقش‌های مدیریتی هنوز فعال نیست: به‌روزرسانی دیتابیس «فاز ۵» را اجرا کنید.');
            exit;
        }
    }

    private static function nameTaken(PDOException $e): void
    {
        if ((int) ($e->errorInfo[1] ?? 0) === 1062) {
            Response::error(409, 'name_taken', 'نقشی با همین نام وجود دارد.');
            return;
        }
        throw $e;
    }
}
