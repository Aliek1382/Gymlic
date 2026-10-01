<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\AdminAccess;
use Gymlic\Auth;
use Gymlic\Cast;
use Gymlic\CronHeartbeat;
use Gymlic\Database;
use Gymlic\DeliveryDispatcher;
use Gymlic\Migrations;
use Gymlic\Response;
use PDO;
use Throwable;

/**
 * The admin's view of the machinery: host and database health, the cron
 * jobs, database updates, a downloadable backup, and the SMS/email queue.
 */
final class AdminSystemController
{
    private const DELIVERY_LIST_LIMIT = 200;

    /** Stops counting upload files here, so a huge folder can't time the page out. */
    private const UPLOAD_SCAN_LIMIT = 50_000;

    public static function health(): void
    {
        Auth::requireAdmin('system');
        $pdo = Database::connection();
        $config = require __DIR__ . '/../../config.php';

        $db = $pdo->query(
            'SELECT VERSION() AS version, NOW() AS now,
                    (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()) AS tables,
                    (SELECT COALESCE(SUM(DATA_LENGTH + INDEX_LENGTH), 0) FROM information_schema.TABLES
                      WHERE TABLE_SCHEMA = DATABASE()) AS size_bytes'
        )->fetch();

        $largest = $pdo->query(
            'SELECT TABLE_NAME AS name, TABLE_ROWS AS approx_rows, DATA_LENGTH + INDEX_LENGTH AS size_bytes
             FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()
             ORDER BY size_bytes DESC LIMIT 8'
        )->fetchAll();

        $extensions = [];
        foreach (['pdo_mysql', 'mbstring', 'curl', 'gd', 'fileinfo', 'openssl', 'zlib'] as $ext) {
            $extensions[$ext] = extension_loaded($ext);
        }

        Response::ok([
            'php' => [
                'version'            => PHP_VERSION,
                'extensions'         => $extensions,
                'upload_max_size'    => (string) ini_get('upload_max_filesize'),
                'post_max_size'      => (string) ini_get('post_max_size'),
                'memory_limit'       => (string) ini_get('memory_limit'),
                'max_execution_time' => (int) ini_get('max_execution_time'),
                'timezone'           => date_default_timezone_get(),
                'now'                => date('Y-m-d H:i:s'),
            ],
            'database' => [
                'version'    => $db['version'],
                'now'        => $db['now'],
                'tables'     => (int) $db['tables'],
                'size_bytes' => (int) $db['size_bytes'],
                'largest'    => Cast::rows($largest, [], ['approx_rows', 'size_bytes']),
            ],
            'uploads' => self::uploadsInfo((string) $config['uploads']['dir']),
            'crons'   => CronHeartbeat::status(),
        ]);
    }

    /**
     * What needs the admin's attention, cheap enough for the overview page:
     * pending database updates, stalled crons, recent failed SMS/email.
     */
    public static function alerts(): void
    {
        Auth::requireAdmin('system');
        $pdo = Database::connection();

        $pending = count(array_filter(Migrations::status(), static fn (array $m): bool => $m['state'] === 'pending'));
        $crons = array_values(array_filter(CronHeartbeat::status(), static fn (array $c): bool => $c['state'] !== 'ok'));

        try {
            $failed = (int) $pdo->query(
                "SELECT COUNT(*) FROM notification_deliveries
                 WHERE status = 'failed' AND created_at >= NOW() - INTERVAL 30 DAY"
            )->fetchColumn();
        } catch (Throwable $e) {
            $failed = 0;
        }

        Response::ok([
            'pending_migrations' => $pending,
            'cron_problems'      => array_map(static fn (array $c): array => ['label' => $c['label'], 'state' => $c['state']], $crons),
            'failed_deliveries'  => $failed,
        ]);
    }

    public static function migrations(): void
    {
        Auth::requireAdmin(AdminAccess::SUPER);
        Response::ok(['items' => Migrations::status()]);
    }

    public static function runMigration(array $params): void
    {
        $admin = Auth::requireAdmin(AdminAccess::SUPER);
        if (!Migrations::exists($params['id'])) {
            Response::error(404, 'not_found', 'این به‌روزرسانی وجود ندارد.');
            return;
        }

        @set_time_limit(300);
        $result = Migrations::run($params['id'], $admin['id']);

        AdminController::logActivity(Database::connection(), null, $admin['id'], null, 'migration_run', [
            'id'       => $params['id'],
            'ok'       => $result['ok'],
            'executed' => $result['executed'],
            'skipped'  => $result['skipped'],
        ]);

        // 200 either way: a failed run is a result to show (which statement,
        // what MySQL said), not a broken request.
        Response::ok($result);
    }

    /**
     * The whole database as a .sql(.gz) file phpMyAdmin can import, streamed
     * table by table so it never sits in memory. Session tokens are left out
     * (structure only): they are live logins, and useless in a restore.
     */
    public static function backup(): void
    {
        $admin = Auth::requireAdmin(AdminAccess::SUPER);
        $pdo = Database::connection();
        @set_time_limit(0);

        AdminController::logActivity($pdo, null, $admin['id'], null, 'backup_downloaded', []);

        $gzip = function_exists('deflate_init');
        $deflate = $gzip ? deflate_init(ZLIB_ENCODING_GZIP, ['level' => 6]) : null;
        $write = static function (string $chunk) use ($deflate): void {
            echo $deflate !== null ? deflate_add($deflate, $chunk, ZLIB_NO_FLUSH) : $chunk;
        };

        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        header('Content-Type: ' . ($gzip ? 'application/gzip' : 'application/sql'));
        header('Content-Disposition: attachment; filename="gymlic-backup-' . date('Y-m-d-His') . ($gzip ? '.sql.gz' : '.sql') . '"');
        header('Cache-Control: no-store');

        $write("-- Gymlic database backup, " . date('Y-m-d H:i:s') . "\n"
            . "-- Restore: phpMyAdmin -> Import. Replaces every table it contains.\n\n"
            . "SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\n\n");

        $tables = $pdo->query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'")->fetchAll(PDO::FETCH_NUM);
        foreach ($tables as [$table]) {
            $create = $pdo->query('SHOW CREATE TABLE `' . str_replace('`', '``', $table) . '`')->fetch(PDO::FETCH_NUM);
            $write("DROP TABLE IF EXISTS `{$table}`;\n{$create[1]};\n\n");

            if ($table === 'sessions') {
                continue;
            }
            self::dumpRows($pdo, $table, $write);
        }

        $write("SET FOREIGN_KEY_CHECKS=1;\n");
        if ($deflate !== null) {
            echo deflate_add($deflate, '', ZLIB_FINISH);
        }
        exit;
    }

    /** ?status=pending|sent|failed &channel=sms|email */
    public static function deliveries(): void
    {
        Auth::requireAdmin('system');
        $pdo = Database::connection();

        $where = [];
        $bind = [];
        if (in_array($_GET['status'] ?? '', ['pending', 'sent', 'failed'], true)) {
            $where[] = 'd.status = :status';
            $bind['status'] = $_GET['status'];
        }
        if (in_array($_GET['channel'] ?? '', ['sms', 'email'], true)) {
            $where[] = 'd.channel = :channel';
            $bind['channel'] = $_GET['channel'];
        }

        try {
            $stmt = $pdo->prepare(
                'SELECT d.id, d.channel, d.status, d.attempts, d.last_error, d.created_at, d.sent_at,
                        n.title, p.id AS recipient_id, p.first_name, p.last_name, p.phone, p.email
                 FROM notification_deliveries d
                 JOIN notifications n ON n.id = d.notification_id
                 JOIN profiles p ON p.id = n.recipient_id'
                . ($where !== [] ? ' WHERE ' . implode(' AND ', $where) : '') . '
                 ORDER BY d.created_at DESC
                 LIMIT ' . self::DELIVERY_LIST_LIMIT
            );
            $stmt->execute($bind);
            $items = $stmt->fetchAll();

            $stats = $pdo->query(
                "SELECT channel,
                        COALESCE(SUM(status = 'sent'), 0) AS sent,
                        COALESCE(SUM(status = 'failed'), 0) AS failed,
                        COALESCE(SUM(status = 'pending'), 0) AS pending,
                        COALESCE(SUM(status = 'sent' AND sent_at IS NOT NULL
                                     AND sent_at >= DATE_FORMAT(NOW(), '%Y-%m-01')), 0) AS sent_this_month
                 FROM notification_deliveries
                 WHERE created_at >= NOW() - INTERVAL 30 DAY
                 GROUP BY channel"
            )->fetchAll();
        } catch (Throwable $e) {
            // notification-channels-update.sql not run: there is no queue yet.
            Response::ok(['ready' => false, 'items' => [], 'stats' => [], 'max_attempts' => DeliveryDispatcher::MAX_ATTEMPTS]);
            return;
        }

        Response::ok([
            'ready'        => true,
            'items'        => Cast::rows($items, [], ['attempts']),
            'stats'        => Cast::rows($stats, [], ['sent', 'failed', 'pending', 'sent_this_month']),
            'max_attempts' => DeliveryDispatcher::MAX_ATTEMPTS,
        ]);
    }

    /** Back in the queue with fresh attempts: the next cron run sends it. */
    public static function retryDelivery(array $params): void
    {
        $admin = Auth::requireAdmin('system');
        $pdo = Database::connection();
        $stmt = $pdo->prepare(
            "UPDATE notification_deliveries SET status = 'pending', attempts = 0, last_error = NULL
             WHERE id = :id AND status = 'failed'"
        );
        $stmt->execute(['id' => $params['id']]);
        if ($stmt->rowCount() === 0) {
            Response::error(409, 'not_failed', 'فقط ارسال ناموفق را می‌شود دوباره در صف گذاشت.');
            return;
        }
        AdminController::logActivity($pdo, null, $admin['id'], null, 'delivery_retried', ['count' => 1]);
        Response::ok(['ok' => true]);
    }

    /** The last 30 days only (what the page counts): an old reminder sent now is noise. */
    public static function retryAllFailed(): void
    {
        $admin = Auth::requireAdmin('system');
        $pdo = Database::connection();
        $count = $pdo->exec(
            "UPDATE notification_deliveries SET status = 'pending', attempts = 0, last_error = NULL
             WHERE status = 'failed' AND created_at >= NOW() - INTERVAL 30 DAY"
        );
        AdminController::logActivity($pdo, null, $admin['id'], null, 'delivery_retried', ['count' => (int) $count]);
        Response::ok(['count' => (int) $count]);
    }

    /** Sends one row right away instead of waiting for the cron, and reports the outcome. */
    public static function sendDelivery(array $params): void
    {
        Auth::requireAdmin('system');
        $pdo = Database::connection();
        $row = DeliveryDispatcher::find($pdo, $params['id']);
        if ($row === null) {
            Response::error(404, 'not_found', 'این ارسال پیدا نشد.');
            return;
        }

        $result = DeliveryDispatcher::send($pdo, $row);
        if ($result === null) {
            Response::error(409, 'already_handled', 'این مورد ارسال شده یا همین حالا در حال ارسال است.');
            return;
        }
        if (!$result[0]) {
            Response::error(502, 'send_failed', 'ارسال ناموفق بود: ' . $result[1]);
            return;
        }
        Response::ok(['ok' => true]);
    }

    /** One multi-row INSERT per 200 rows, read unbuffered so a big table never fills memory. */
    private static function dumpRows(PDO $pdo, string $table, callable $write): void
    {
        $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, false);
        try {
            $stmt = $pdo->query('SELECT * FROM `' . str_replace('`', '``', $table) . '`');
            $batch = [];
            $columns = null;
            while (($row = $stmt->fetch(PDO::FETCH_ASSOC)) !== false) {
                $columns ??= '(`' . implode('`, `', array_keys($row)) . '`)';
                $values = [];
                foreach ($row as $value) {
                    $values[] = $value === null ? 'NULL' : $pdo->quote((string) $value);
                }
                $batch[] = '(' . implode(', ', $values) . ')';
                if (count($batch) === 200) {
                    $write("INSERT INTO `{$table}` {$columns} VALUES\n" . implode(",\n", $batch) . ";\n");
                    $batch = [];
                }
            }
            if ($batch !== []) {
                $write("INSERT INTO `{$table}` {$columns} VALUES\n" . implode(",\n", $batch) . ";\n");
            }
            $stmt->closeCursor();
            $write("\n");
        } finally {
            $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, true);
        }
    }

    /** @return array{writable: bool, files: int, size_bytes: int, truncated: bool, free_bytes: ?int} */
    private static function uploadsInfo(string $dir): array
    {
        $files = 0;
        $size = 0;
        $truncated = false;
        if (is_dir($dir)) {
            try {
                $iterator = new \RecursiveIteratorIterator(
                    new \RecursiveDirectoryIterator($dir, \FilesystemIterator::SKIP_DOTS)
                );
                foreach ($iterator as $file) {
                    if (!$file->isFile()) {
                        continue;
                    }
                    if (++$files > self::UPLOAD_SCAN_LIMIT) {
                        $truncated = true;
                        break;
                    }
                    $size += $file->getSize();
                }
            } catch (Throwable $e) {
                // An unreadable subfolder: report what was counted.
            }
        }

        $free = function_exists('disk_free_space') ? @disk_free_space(is_dir($dir) ? $dir : __DIR__) : false;

        return [
            'writable'   => is_dir($dir) && is_writable($dir),
            'files'      => min($files, self::UPLOAD_SCAN_LIMIT),
            'size_bytes' => $size,
            'truncated'  => $truncated,
            'free_bytes' => $free === false ? null : (int) $free,
        ];
    }
}
