<?php
declare(strict_types=1);

namespace Gymlic;

use Throwable;

/**
 * The errors the admin sees in the panel (/admin/errors) instead of in the
 * host's log files: what PHP throws or warns about, and what breaks in
 * users' browsers (ClientErrorController). One row per kind of error, by a
 * fingerprint of its message (with numbers and ids taken out) and place; a
 * repeat only bumps its count and time, so a loop can't fill the table.
 *
 * Never throws, and never needs the table: before operations-update.sql has
 * run (or with the database down) everything still goes to error_log().
 */
final class ErrorLog
{
    /** PHP warnings worth seeing; notices and deprecations are noise on shared hosting. */
    private const PHP_LEVELS = E_WARNING | E_USER_WARNING | E_USER_ERROR | E_RECOVERABLE_ERROR | E_CORE_WARNING | E_COMPILE_WARNING;

    private const FATAL = E_ERROR | E_PARSE | E_CORE_ERROR | E_COMPILE_ERROR;

    /** New kinds of browser error accepted per hour, across everyone. Repeats are always counted. */
    private const BROWSER_NEW_PER_HOUR = 100;

    private static bool $writing = false;

    private function __construct()
    {
    }

    /** Warnings and fatal errors from here on are recorded too (uncaught exceptions are caught by the caller). */
    public static function register(): void
    {
        set_error_handler(static function (int $level, string $message, string $file, int $line): bool {
            if ((error_reporting() & $level) !== 0 && ($level & self::PHP_LEVELS) !== 0) {
                self::record('server', $message, self::place($file, $line), self::trace(debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS)), self::requestUrl());
            }
            return false; // PHP's own handling (error_log) carries on as before
        });
        register_shutdown_function(static function (): void {
            $error = error_get_last();
            if ($error !== null && ($error['type'] & self::FATAL) !== 0) {
                self::record('server', $error['message'], self::place($error['file'], $error['line']), null, self::requestUrl());
            }
        });
    }

    /** For the cron scripts: as register(), and an uncaught exception is recorded before the script dies. */
    public static function registerCli(): void
    {
        self::register();
        set_exception_handler(static function (Throwable $e): void {
            self::exception($e);
            fwrite(STDERR, get_class($e) . ': ' . $e->getMessage() . "\n");
            exit(1);
        });
    }

    public static function exception(Throwable $e): void
    {
        error_log(get_class($e) . ': ' . $e->getMessage() . ' at ' . $e->getFile() . ':' . $e->getLine());
        self::record(
            'server',
            get_class($e) . ': ' . $e->getMessage(),
            self::place($e->getFile(), $e->getLine()),
            // Paths relative to the backend folder, like place(): the host's layout says nothing useful.
            str_replace(dirname(__DIR__) . '/', '', $e->getTraceAsString()),
            self::requestUrl()
        );
    }

    /**
     * What a browser reported (ClientErrorController); already trimmed there.
     * Returns false when it was dropped (too many new kinds this hour).
     */
    public static function browser(string $message, ?string $location, ?string $stack, ?string $url, ?string $userId, ?string $userAgent): bool
    {
        return self::record('browser', $message, $location, $stack, $url, $userId, $userAgent, true);
    }

    /** Whether the table exists (operations-update.sql has run). */
    public static function ready(): bool
    {
        return Database::hasTable('error_logs');
    }

    private static function record(
        string $source,
        string $message,
        ?string $location,
        ?string $detail,
        ?string $url,
        ?string $userId = null,
        ?string $userAgent = null,
        bool $limitNew = false
    ): bool {
        // An error while recording an error must not recurse.
        if (self::$writing) {
            return false;
        }
        self::$writing = true;
        try {
            if (!self::ready()) {
                return false;
            }
            $pdo = Database::connection();
            $message = mb_substr(trim($message), 0, 1000);
            // A PHP line is its own error; a browser bundle's name and position change with every build.
            $place = $source === 'browser' ? self::normalize((string) $location) : (string) $location;
            $fingerprint = sha1($source . '|' . self::normalize($message) . '|' . $place);

            if ($limitNew) {
                $known = $pdo->prepare('SELECT 1 FROM error_logs WHERE fingerprint = :f');
                $known->execute(['f' => $fingerprint]);
                if ($known->fetchColumn() === false) {
                    $recent = $pdo->query(
                        "SELECT COUNT(*) FROM error_logs WHERE source = 'browser' AND first_seen > NOW() - INTERVAL 1 HOUR"
                    )->fetchColumn();
                    if ((int) $recent >= self::BROWSER_NEW_PER_HOUR) {
                        return false;
                    }
                }
            }

            $pdo->prepare(
                'INSERT INTO error_logs (id, fingerprint, source, message, location, detail, url, user_id, user_agent)
                 VALUES (:id, :fingerprint, :source, :message, :location, :detail, :url, :user_id, :user_agent)
                 ON DUPLICATE KEY UPDATE occurrences = occurrences + 1, last_seen = NOW(), resolved_at = NULL,
                   message = VALUES(message), detail = COALESCE(VALUES(detail), detail),
                   url = COALESCE(VALUES(url), url), user_id = COALESCE(VALUES(user_id), user_id),
                   user_agent = COALESCE(VALUES(user_agent), user_agent)'
            )->execute([
                'id'          => Uuid::v4(),
                'fingerprint' => $fingerprint,
                'source'      => $source,
                'message'     => $message,
                'location'    => $location === null ? null : mb_substr($location, 0, 500),
                'detail'      => $detail === null ? null : mb_substr($detail, 0, 8000),
                'url'         => $url === null ? null : mb_substr($url, 0, 500),
                'user_id'     => $userId ?? self::currentUserId(),
                'user_agent'  => $userAgent === null
                    ? (isset($_SERVER['HTTP_USER_AGENT']) ? substr((string) $_SERVER['HTTP_USER_AGENT'], 0, 255) : null)
                    : substr($userAgent, 0, 255),
            ]);
            return true;
        } catch (Throwable $e) {
            error_log('ErrorLog: ' . $e->getMessage());
            return false;
        } finally {
            self::$writing = false;
        }
    }

    /** Numbers, ids and quoted values vary between occurrences of the same error. */
    private static function normalize(string $text): string
    {
        $text = preg_replace('/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i', '#', $text) ?? $text;
        $text = preg_replace('/\?[^\s)]*/', '', $text) ?? $text; // query strings in URLs
        $text = preg_replace("/'[^']{0,200}'|\"[^\"]{0,200}\"/", '"…"', $text) ?? $text;
        return preg_replace('/\d+/', '0', $text) ?? $text;
    }

    /** A path relative to the backend folder: the host's absolute path says nothing useful. */
    private static function place(string $file, int $line): string
    {
        $root = dirname(__DIR__) . '/';
        return (str_starts_with($file, $root) ? substr($file, strlen($root)) : basename($file)) . ':' . $line;
    }

    private static function trace(array $frames): string
    {
        $lines = [];
        foreach (array_slice($frames, 1, 15) as $i => $frame) {
            $where = isset($frame['file']) ? self::place($frame['file'], (int) ($frame['line'] ?? 0)) : '[internal]';
            $lines[] = "#{$i} {$where} " . ($frame['class'] ?? '') . ($frame['type'] ?? '') . ($frame['function'] ?? '') . '()';
        }
        return implode("\n", $lines);
    }

    private static function requestUrl(): ?string
    {
        if (PHP_SAPI === 'cli') {
            return 'cron: ' . basename((string) ($_SERVER['SCRIPT_NAME'] ?? ''));
        }
        return ($_SERVER['REQUEST_METHOD'] ?? 'GET') . ' ' . (string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
    }

    /** Who was signed in, when it can be told without another error (no new lookups). */
    private static function currentUserId(): ?string
    {
        return Auth::lastUserId();
    }
}
