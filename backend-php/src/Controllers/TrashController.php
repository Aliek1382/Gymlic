<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\AdminAccess;
use Gymlic\Auth;
use Gymlic\Cast;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Trash;
use PDO;
use PDOException;
use RuntimeException;
use Throwable;

/**
 * The recycle bin (/admin/trash) and the deletes that only exist because it
 * does: a whole user account, a whole club. Pages and discount codes go
 * through their own delete endpoints, which put them here too (see Trash).
 */
final class TrashController
{
    private const KIND_LABEL = [
        'user'             => 'کاربر',
        'club'             => 'باشگاه',
        'page'             => 'صفحهٔ متنی',
        'discount'         => 'کد تخفیف باشگاه',
        'trainer_discount' => 'کد تخفیف مربی',
    ];

    private const ROLE_LABEL = ['club' => 'مدیر باشگاه', 'trainer' => 'مربی', 'athlete' => 'ورزشکار'];

    public static function list(): void
    {
        $admin = Auth::requireAdmin();
        if (!Trash::ready()) {
            Response::ok(['ready' => false, 'retention_days' => Trash::RETENTION_DAYS, 'items' => []]);
            return;
        }
        $pdo = Database::connection();
        Trash::purgeIfDue($pdo);

        $kinds = array_keys(array_filter(Trash::KINDS, static fn (string $p): bool => AdminAccess::can($admin, $p)));
        if ($kinds === []) {
            Response::ok(['ready' => true, 'retention_days' => Trash::RETENTION_DAYS, 'items' => []]);
            return;
        }
        $marks = implode(',', array_fill(0, count($kinds), '?'));
        $stmt = $pdo->prepare(
            "SELECT t.id, t.kind, t.label, t.summary, t.deleted_at, LENGTH(t.payload) AS bytes,
                    CONCAT_WS(' ', p.first_name, p.last_name) AS deleted_by_name
             FROM trash t LEFT JOIN profiles p ON p.id = t.deleted_by
             WHERE t.kind IN ({$marks}) ORDER BY t.deleted_at DESC"
        );
        $stmt->execute($kinds);
        $items = array_map(static function (array $row): array {
            $row['kind_label'] = self::KIND_LABEL[$row['kind']] ?? $row['kind'];
            $row['purge_at'] = date('Y-m-d H:i:s', strtotime((string) $row['deleted_at']) + Trash::RETENTION_DAYS * 86400);
            return $row;
        }, $stmt->fetchAll());

        Response::ok([
            'ready'          => true,
            'retention_days' => Trash::RETENTION_DAYS,
            'items'          => Cast::rows($items, [], ['bytes']),
        ]);
    }

    public static function restore(array $params): void
    {
        $admin = Auth::requireAdmin();
        $pdo = Database::connection();
        self::requireReady();
        self::requireKindAccess($pdo, $admin, $params['id']);

        $pdo->beginTransaction();
        try {
            $result = Trash::restore($pdo, $params['id']);
            $pdo->commit();
        } catch (PDOException $e) {
            $pdo->rollBack();
            throw $e; // a database error, not a reason for the admin: logged as such
        } catch (RuntimeException $e) {
            $pdo->rollBack();
            Response::error(409, 'restore_failed', $e->getMessage());
            return;
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
        AdminController::logActivity($pdo, null, $admin['id'], null, 'trash_restored', [
            'kind' => $result['kind'], 'label' => $result['label'],
        ]);
        Response::ok($result);
    }

    public static function purge(array $params): void
    {
        $admin = Auth::requireAdmin();
        $pdo = Database::connection();
        self::requireReady();
        self::requireKindAccess($pdo, $admin, $params['id']);
        try {
            $result = Trash::purge($pdo, $params['id']);
        } catch (RuntimeException $e) {
            Response::error(404, 'not_found', $e->getMessage());
            return;
        }
        AdminController::logActivity($pdo, null, $admin['id'], null, 'trash_purged', $result);
        Response::ok(['ok' => true]);
    }

    /**
     * DELETE /admin/users/{id} — the account and everything that is only
     * theirs (plans, messages, payments, and any club they own), into the
     * bin. Super admin only; never an admin account, never your own.
     */
    public static function deleteUser(array $params): void
    {
        $admin = Auth::requireAdmin(AdminAccess::SUPER);
        self::requireReady();
        $pdo = Database::connection();

        $stmt = $pdo->prepare(
            'SELECT id, first_name, last_name, email, phone, account_type, is_platform_admin'
            . (AdminAccess::rolesReady() ? ', admin_role_id' : '') . ' FROM profiles WHERE id = :id'
        );
        $stmt->execute(['id' => $params['id']]);
        $user = $stmt->fetch();
        if ($user === false) {
            Response::error(404, 'not_found', 'این کاربر پیدا نشد.');
            return;
        }
        if ($user['id'] === $admin['id']) {
            Response::error(409, 'self', 'حساب خودتان را نمی‌توانید حذف کنید.');
            return;
        }
        if (AdminAccess::isAdminAccount($user)) {
            Response::error(409, 'admin_target', 'حساب مدیران حذف نمی‌شود؛ اول دسترسی مدیریتش را بردارید.');
            return;
        }

        $clubs = $pdo->prepare('SELECT id, name FROM clubs WHERE owner_id = :id');
        $clubs->execute(['id' => $user['id']]);
        $clubs = $clubs->fetchAll();

        $name = trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? '')) ?: ($user['email'] ?? $user['phone'] ?? 'بدون نام');
        $summary = implode(' · ', array_filter([
            self::ROLE_LABEL[$user['account_type'] ?? ''] ?? 'بدون نقش',
            $user['email'] ?? $user['phone'],
            $clubs !== [] ? 'همراه با باشگاه ' . implode('، ', array_column($clubs, 'name')) : null,
        ]));

        // The user before their clubs: Trash deletes in reverse, clubs first.
        $roots = [['profiles', 'id', $user['id']]];
        foreach ($clubs as $club) {
            $roots[] = ['clubs', 'id', $club['id']];
        }
        $id = self::trash($pdo, 'user', $roots, $name, $summary, $admin['id']);
        AdminController::logActivity($pdo, null, $admin['id'], null, 'user_deleted', ['name' => $name, 'email' => $user['email']]);
        Response::ok(['trash_id' => $id]);
    }

    /** DELETE /admin/clubs/{id} — the club with its members' memberships, plans and finances; the owner's account stays. */
    public static function deleteClub(array $params): void
    {
        $admin = Auth::requireAdmin(AdminAccess::SUPER);
        self::requireReady();
        $pdo = Database::connection();

        $stmt = $pdo->prepare(
            "SELECT c.id, c.name, CONCAT_WS(' ', p.first_name, p.last_name) AS owner_name,
                    (SELECT COUNT(*) FROM memberships m WHERE m.club_id = c.id) AS members
             FROM clubs c LEFT JOIN profiles p ON p.id = c.owner_id WHERE c.id = :id"
        );
        $stmt->execute(['id' => $params['id']]);
        $club = $stmt->fetch();
        if ($club === false) {
            Response::error(404, 'not_found', 'این باشگاه پیدا نشد.');
            return;
        }

        $summary = 'مدیر: ' . ($club['owner_name'] ?: '—') . ' · ' . (int) $club['members'] . ' عضویت';
        $id = self::trash($pdo, 'club', [['clubs', 'id', $club['id']]], $club['name'], $summary, $admin['id']);
        // No club id on the log entry: the club is gone (it would be logged against nothing).
        AdminController::logActivity($pdo, null, $admin['id'], null, 'club_deleted', ['name' => $club['name']]);
        Response::ok(['trash_id' => $id]);
    }

    /** For the other delete endpoints: their row into the bin, in its own transaction. */
    public static function trash(PDO $pdo, string $kind, array $roots, string $label, ?string $summary, string $adminId): string
    {
        $pdo->beginTransaction();
        try {
            $id = Trash::delete($pdo, $kind, $roots, $label, $summary, $adminId);
            $pdo->commit();
            return $id;
        } catch (PDOException $e) {
            $pdo->rollBack();
            throw $e;
        } catch (RuntimeException $e) {
            $pdo->rollBack();
            Response::error(409, 'delete_blocked', $e->getMessage());
            exit;
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    private static function requireReady(): void
    {
        if (!Trash::ready()) {
            Response::error(409, 'migration_required', 'سطل زباله هنوز فعال نیست. به‌روزرسانی «لاگ خطاها، سطل زباله و تأیید مدارک مربی (فاز ۱۰)» را از صفحهٔ «به‌روزرسانی دیتابیس» اجرا کنید.');
            exit;
        }
    }

    private static function requireKindAccess(PDO $pdo, array $admin, string $id): void
    {
        $stmt = $pdo->prepare('SELECT kind FROM trash WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $kind = $stmt->fetchColumn();
        if ($kind === false) {
            Response::error(404, 'not_found', 'این مورد در سطل زباله نیست.');
            exit;
        }
        Auth::requireAdmin(Trash::KINDS[$kind] ?? AdminAccess::SUPER);
    }
}
