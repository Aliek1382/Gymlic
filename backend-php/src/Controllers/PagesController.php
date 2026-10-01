<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Validate;

/**
 * Text pages the admin writes in /admin/pages — terms, privacy, FAQ, help,
 * or any other — readable by anyone at /page?slug=… once published. The
 * body is plain text with a little Markdown (headings, lists, bold, links),
 * rendered by the frontend without HTML, so nothing typed here can run as
 * script on the site.
 */
final class PagesController
{
    private const MAX_BODY = 100000;

    public static function ready(): bool
    {
        return Database::hasColumn('site_pages', 'slug');
    }

    /** Published pages for the site's links; no session needed. */
    public static function listPublic(): void
    {
        if (!self::ready()) {
            Response::ok(['items' => []]);
            return;
        }
        $rows = Database::connection()->query(
            'SELECT slug, title FROM site_pages WHERE is_published = 1 ORDER BY sort_order, title'
        )->fetchAll();
        Response::ok(['items' => $rows]);
    }

    public static function getPublic(array $params): void
    {
        $page = self::ready() ? self::find($params['slug']) : null;
        if ($page === null || !(bool) $page['is_published']) {
            Response::error(404, 'not_found', 'این صفحه پیدا نشد.');
            return;
        }
        Response::ok(['page' => self::cast($page)]);
    }

    public static function adminList(): void
    {
        Auth::requireAdmin('content');
        if (!self::ready()) {
            Response::ok(['ready' => false, 'items' => []]);
            return;
        }
        $rows = Database::connection()->query(
            "SELECT s.slug, s.title, s.body, s.is_published, s.sort_order, s.updated_at,
                    CONCAT_WS(' ', p.first_name, p.last_name) AS updated_by_name
             FROM site_pages s LEFT JOIN profiles p ON p.id = s.updated_by
             ORDER BY s.sort_order, s.title"
        )->fetchAll();
        Response::ok(['ready' => true, 'items' => array_map([self::class, 'cast'], $rows)]);
    }

    /** PUT /admin/pages/{slug}: creates the page, or replaces it. */
    public static function save(array $params): void
    {
        $admin = Auth::requireAdmin('content');
        if (!self::requireReady()) {
            return;
        }
        $slug = (string) $params['slug'];
        if (preg_match('/^[a-z0-9][a-z0-9-]{1,59}$/', $slug) !== 1) {
            Response::error(400, 'invalid_slug', 'نشانی صفحه باید ۲ تا ۶۰ حرف کوچک انگلیسی، عدد یا خط تیره باشد.');
            return;
        }
        $data = Validate::body();
        $title = trim((string) ($data['title'] ?? ''));
        if ($title === '' || mb_strlen($title) > 150) {
            Response::error(400, 'invalid_title', 'عنوان صفحه را وارد کنید (حداکثر ۱۵۰ نویسه).');
            return;
        }
        $body = (string) ($data['body'] ?? '');
        if (mb_strlen($body) > self::MAX_BODY) {
            Response::error(400, 'invalid_body', 'متن صفحه بیش از اندازه طولانی است.');
            return;
        }
        $published = !empty($data['is_published']);
        if ($published && trim($body) === '') {
            Response::error(400, 'empty_page', 'صفحهٔ خالی منتشر نمی‌شود؛ اول متنش را بنویسید.');
            return;
        }
        $sort = is_numeric($data['sort_order'] ?? null) ? max(0, min(1000, (int) $data['sort_order'])) : 0;

        $pdo = Database::connection();
        $existed = self::find($slug) !== null;
        $pdo->prepare(
            'INSERT INTO site_pages (slug, title, body, is_published, sort_order, updated_by)
             VALUES (:slug, :title, :body, :published, :sort, :admin)
             ON DUPLICATE KEY UPDATE title = VALUES(title), body = VALUES(body), is_published = VALUES(is_published),
                                     sort_order = VALUES(sort_order), updated_by = VALUES(updated_by)'
        )->execute(['slug' => $slug, 'title' => $title, 'body' => $body, 'published' => $published ? 1 : 0, 'sort' => $sort, 'admin' => $admin['id']]);

        AdminController::logActivity($pdo, null, $admin['id'], null, 'page_saved', [
            'slug' => $slug, 'title' => $title, 'published' => $published, 'created' => !$existed,
        ]);
        Response::ok(['page' => self::cast(self::find($slug))], $existed ? 200 : 201);
    }

    public static function delete(array $params): void
    {
        $admin = Auth::requireAdmin('content');
        if (!self::requireReady()) {
            return;
        }
        $page = self::find((string) $params['slug']);
        if ($page === null) {
            Response::error(404, 'not_found', 'این صفحه پیدا نشد.');
            return;
        }
        $pdo = Database::connection();
        $pdo->prepare('DELETE FROM site_pages WHERE slug = :slug')->execute(['slug' => $page['slug']]);
        AdminController::logActivity($pdo, null, $admin['id'], null, 'page_deleted', ['slug' => $page['slug'], 'title' => $page['title']]);
        Response::ok(['ok' => true]);
    }

    private static function requireReady(): bool
    {
        if (self::ready()) {
            return true;
        }
        Response::error(503, 'pages_not_ready', 'صفحه‌های متنی هنوز فعال نیست. به‌روزرسانی «اعلان همگانی، تیکت پشتیبانی و صفحه‌های متنی (فاز ۷)» را از صفحهٔ «به‌روزرسانی دیتابیس» اجرا کنید.');
        return false;
    }

    private static function find(string $slug): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM site_pages WHERE slug = :slug');
        $stmt->execute(['slug' => $slug]);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    private static function cast(array $row): array
    {
        $row['is_published'] = (bool) $row['is_published'];
        $row['sort_order'] = (int) $row['sort_order'];
        unset($row['updated_by'], $row['created_at']);
        return $row;
    }
}
