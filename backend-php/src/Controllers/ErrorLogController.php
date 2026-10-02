<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Auth;
use Gymlic\Cast;
use Gymlic\Database;
use Gymlic\ErrorLog;
use Gymlic\Response;
use Gymlic\Validate;

/**
 * The site's errors in the admin panel (/admin/errors, system permission):
 * what PHP threw or warned about and what broke in users' browsers, one row
 * per kind (see ErrorLog). And the endpoint the browser reports to.
 */
final class ErrorLogController
{
    private const LIST_LIMIT = 200;

    /**
     * POST /client-errors — no login needed (an error on the login page is an
     * error too), but a signed-in user is attached. Always answers 204: the
     * page that reports must never get an error back about its report.
     */
    public static function report(): void
    {
        $data = Validate::body();
        $message = trim((string) ($data['message'] ?? ''));
        if ($message !== '' && mb_strlen($message) <= 2000) {
            $user = null;
            try {
                $user = Auth::currentUser();
            } catch (\Throwable $e) {
                // An unknown or expired token: report it unattached.
            }
            ErrorLog::browser(
                mb_substr($message, 0, 1000),
                self::text($data['location'] ?? null, 500),
                self::text($data['stack'] ?? null, 4000),
                self::text($data['url'] ?? null, 500),
                $user['id'] ?? null,
                isset($_SERVER['HTTP_USER_AGENT']) ? (string) $_SERVER['HTTP_USER_AGENT'] : null
            );
        }
        http_response_code(204);
    }

    /** ?status=open|resolved|all ?source=server|browser */
    public static function list(): void
    {
        Auth::requireAdmin('system');
        if (!ErrorLog::ready()) {
            Response::ok(['ready' => false, 'items' => [], 'counts' => ['open' => 0, 'resolved' => 0]]);
            return;
        }

        $where = [];
        $bind = [];
        $status = (string) ($_GET['status'] ?? 'open');
        if ($status === 'open') {
            $where[] = 'e.resolved_at IS NULL';
        } elseif ($status === 'resolved') {
            $where[] = 'e.resolved_at IS NOT NULL';
        }
        $source = (string) ($_GET['source'] ?? '');
        if (in_array($source, ['server', 'browser'], true)) {
            $where[] = 'e.source = :source';
            $bind['source'] = $source;
        }

        $pdo = Database::connection();
        $stmt = $pdo->prepare(
            "SELECT e.id, e.source, e.message, e.location, e.detail, e.url, e.user_agent, e.occurrences,
                    e.first_seen, e.last_seen, e.resolved_at, e.user_id,
                    CONCAT_WS(' ', p.first_name, p.last_name) AS user_name, p.email AS user_email
             FROM error_logs e LEFT JOIN profiles p ON p.id = e.user_id"
            . ($where !== [] ? ' WHERE ' . implode(' AND ', $where) : '') . '
             ORDER BY e.last_seen DESC LIMIT ' . self::LIST_LIMIT
        );
        $stmt->execute($bind);

        $counts = $pdo->query(
            'SELECT SUM(resolved_at IS NULL) AS open, SUM(resolved_at IS NOT NULL) AS resolved,
                    SUM(resolved_at IS NULL AND last_seen > NOW() - INTERVAL 1 DAY) AS today
             FROM error_logs'
        )->fetch();

        Response::ok([
            'ready'  => true,
            'items'  => Cast::rows($stmt->fetchAll(), [], ['occurrences']),
            'counts' => [
                'open'     => (int) ($counts['open'] ?? 0),
                'resolved' => (int) ($counts['resolved'] ?? 0),
                'today'    => (int) ($counts['today'] ?? 0),
            ],
        ]);
    }

    /** {resolved: bool} — "fixed" hides it until it happens again. */
    public static function setResolved(array $params): void
    {
        Auth::requireAdmin('system');
        $resolved = (bool) (Validate::body()['resolved'] ?? true);
        self::requireReady();
        Database::connection()->prepare(
            'UPDATE error_logs SET resolved_at = ' . ($resolved ? 'NOW()' : 'NULL') . ' WHERE id = :id'
        )->execute(['id' => $params['id']]);
        Response::ok(['ok' => true]);
    }

    /** Marks every open one fixed (after a deploy that fixed them). */
    public static function resolveAll(): void
    {
        $admin = Auth::requireAdmin('system');
        self::requireReady();
        $pdo = Database::connection();
        $count = $pdo->exec('UPDATE error_logs SET resolved_at = NOW() WHERE resolved_at IS NULL');
        AdminController::logActivity($pdo, null, $admin['id'], null, 'errors_resolved', ['count' => (int) $count]);
        Response::ok(['count' => (int) $count]);
    }

    /** Deletes the fixed ones. */
    public static function clearResolved(): void
    {
        $admin = Auth::requireAdmin('system');
        self::requireReady();
        $pdo = Database::connection();
        $count = $pdo->exec('DELETE FROM error_logs WHERE resolved_at IS NOT NULL');
        AdminController::logActivity($pdo, null, $admin['id'], null, 'errors_cleared', ['count' => (int) $count]);
        Response::ok(['count' => (int) $count]);
    }

    private static function requireReady(): void
    {
        if (!ErrorLog::ready()) {
            Response::error(409, 'migration_required', 'لاگ خطاها هنوز فعال نیست. به‌روزرسانی «لاگ خطاها، سطل زباله و تأیید مدارک مربی (فاز ۱۰)» را از صفحهٔ «به‌روزرسانی دیتابیس» اجرا کنید.');
            exit;
        }
    }

    private static function text(mixed $value, int $max): ?string
    {
        if (!is_string($value) || trim($value) === '') {
            return null;
        }
        return mb_substr(trim($value), 0, $max);
    }
}
