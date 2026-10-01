<?php
declare(strict_types=1);

namespace Gymlic;

use PDO;

/**
 * Bearer-token auth (not cookies): the static Next.js export usually lives on a
 * different (sub)domain than this API on shared hosting, which makes cross-site
 * cookies fragile (SameSite/Secure quirks on cheap hosts, no shared parent domain
 * guaranteed). The frontend stores the token (e.g. localStorage) and sends
 * `Authorization: Bearer <token>`, same shape as the Supabase JWT it replaces.
 */
final class Auth
{
    private function __construct()
    {
    }

    public static function createSession(string $userId): array
    {
        $pdo = Database::connection();
        $config = require __DIR__ . '/../config.php';

        $token = bin2hex(random_bytes(32));
        $expiresAt = date('Y-m-d H:i:s', time() + $config['session_ttl_seconds']);

        $stmt = $pdo->prepare(
            'INSERT INTO sessions (token, user_id, user_agent, ip_address, expires_at)
             VALUES (:token, :user_id, :user_agent, :ip_address, :expires_at)'
        );
        $stmt->execute([
            'token'      => $token,
            'user_id'    => $userId,
            'user_agent' => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255),
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
            'expires_at' => $expiresAt,
        ]);

        return ['token' => $token, 'expires_at' => $expiresAt];
    }

    /**
     * A short, read-only session on $userId's account for $adminId to see
     * their panel as they do. Needs analytics-update.sql (the caller checks).
     */
    public static function createViewSession(string $userId, string $adminId, int $ttlSeconds): array
    {
        $token = bin2hex(random_bytes(32));
        $expiresAt = date('Y-m-d H:i:s', time() + $ttlSeconds);

        Database::connection()->prepare(
            'INSERT INTO sessions (token, user_id, user_agent, ip_address, impersonated_by, read_only, expires_at)
             VALUES (:token, :user_id, :user_agent, :ip_address, :admin_id, 1, :expires_at)'
        )->execute([
            'token'      => $token,
            'user_id'    => $userId,
            'user_agent' => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255),
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
            'admin_id'   => $adminId,
            'expires_at' => $expiresAt,
        ]);

        return ['token' => $token, 'expires_at' => $expiresAt];
    }

    /** Whether view sessions can exist yet (phase 9's SQL has run). */
    public static function viewSessionsReady(): bool
    {
        return Database::hasColumn('sessions', 'read_only');
    }

    public static function destroySession(string $token): void
    {
        $stmt = Database::connection()->prepare('DELETE FROM sessions WHERE token = :token');
        $stmt->execute(['token' => $token]);
    }

    private static function bearerToken(): ?string
    {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if ($header === '' && function_exists('apache_request_headers')) {
            foreach (apache_request_headers() as $name => $value) {
                if (strcasecmp($name, 'Authorization') === 0) {
                    $header = $value;
                    break;
                }
            }
        }
        if (preg_match('/^Bearer\s+(\S+)$/i', $header, $m)) {
            return $m[1];
        }
        return null;
    }

    /** The columns of `sessions` that ride along in currentUser()'s row and are taken back out of it. */
    private const SESSION_COLUMNS = ['token', 'user_id', 'user_agent', 'ip_address', 'impersonated_by', 'read_only', 'expires_at'];

    /** @var array{impersonated_by: ?string, read_only: bool, expires_at: string}|null the session behind the last currentUser() */
    private static ?array $session = null;

    /**
     * Returns the authenticated profile row, or null if no/invalid/expired token.
     *
     * A read-only session (a super admin viewing someone's panel, see
     * AdminUsersController::viewAs) ends any request that would change
     * something with a 403 here, before the endpoint runs.
     */
    public static function currentUser(): ?array
    {
        self::$session = null;
        $token = self::bearerToken();
        if ($token === null) {
            return null;
        }

        $pdo = Database::connection();
        // s.* so the read-only columns come along once they exist, with no
        // extra query to ask whether they do. p.* comes last: its created_at
        // is the one that stays.
        $stmt = $pdo->prepare(
            'SELECT s.*, p.* FROM sessions s
             JOIN profiles p ON p.id = s.user_id
             WHERE s.token = :token AND s.expires_at > NOW()'
        );
        $stmt->execute(['token' => $token]);
        $user = $stmt->fetch();
        if ($user === false) {
            return null;
        }

        self::$session = [
            'impersonated_by' => isset($user['impersonated_by']) ? (string) $user['impersonated_by'] : null,
            'read_only'       => (int) ($user['read_only'] ?? 0) === 1,
            'expires_at'      => (string) $user['expires_at'],
        ];
        foreach (self::SESSION_COLUMNS as $column) {
            unset($user[$column]);
        }

        if (self::$session['read_only']) {
            self::enforceReadOnly($pdo);
            // Someone looking at the panel on the user's behalf is not the user using it.
            return $user;
        }

        // "Last seen" for the admin's inactive-users audience, and the day's
        // entry in daily_active for the growth charts: at most one write an
        // hour, and the first request of a new day. The column only exists
        // once phase 7's SQL has run, the table once phase 9's has.
        if (array_key_exists('last_seen_at', $user)
            && ($user['last_seen_at'] === null
                || strtotime((string) $user['last_seen_at']) < time() - 3600
                || date('Y-m-d', strtotime((string) $user['last_seen_at'])) !== date('Y-m-d'))) {
            try {
                $pdo->prepare('UPDATE profiles SET last_seen_at = :now WHERE id = :id')
                    ->execute(['now' => date('Y-m-d H:i:s'), 'id' => $user['id']]);
                if (Database::hasTable('daily_active')) {
                    $pdo->prepare('INSERT IGNORE INTO daily_active (day, user_id) VALUES (:day, :id)')
                        ->execute(['day' => date('Y-m-d'), 'id' => $user['id']]);
                }
            } catch (\Throwable $e) {
                error_log('last_seen: ' . $e->getMessage());
            }
        }

        return $user;
    }

    /**
     * The session behind the last currentUser() call: who is viewing on the
     * user's behalf, if anyone, and whether it may change anything.
     *
     * @return array{impersonated_by: ?string, read_only: bool, expires_at: string}|null
     */
    public static function session(): ?array
    {
        return self::$session;
    }

    /**
     * Only reading, and signing out of the view. Anything else is refused
     * before it runs; and should a GET somewhere write as a side effect, the
     * database refuses that too (a read-only transaction mode for the rest
     * of this connection).
     */
    private static function enforceReadOnly(PDO $pdo): void
    {
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        $path = (string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
        if ($method !== 'GET' && $method !== 'HEAD' && !str_ends_with(rtrim($path, '/'), '/auth/logout')) {
            Response::error(403, 'read_only_session', 'این نمای فقط‌خواندنی پنل کاربر است و هیچ تغییری در آن ذخیره نمی‌شود.');
            exit;
        }
        if ($method === 'GET' || $method === 'HEAD') {
            $pdo->exec('SET SESSION TRANSACTION READ ONLY');
        }
    }

    /** Ends the request with 401 if there's no valid session; otherwise returns the user. */
    public static function requireUser(): array
    {
        $user = self::currentUser();
        if ($user === null) {
            Response::error(401, 'unauthenticated', 'Login required.');
            exit;
        }
        if ((int) $user['is_suspended'] === 1) {
            Response::error(403, 'account_suspended', 'This account has been suspended.');
            exit;
        }
        return $user;
    }

    /** A super admin (profiles.is_platform_admin) — for what no role can be given. */
    public static function requirePlatformAdmin(): array
    {
        return self::requireAdmin(AdminAccess::SUPER);
    }

    /**
     * Any admin holding at least one of $permissions (AdminAccess keys, or
     * AdminAccess::SUPER). With none given, any admin at all.
     *
     * @param string|string[] $permissions
     */
    public static function requireAdmin(string|array $permissions = []): array
    {
        $user = self::requireUser();
        // A view of someone's panel is never an admin session, whoever they are.
        if (AdminAccess::of($user) === null || (self::$session['impersonated_by'] ?? null) !== null) {
            Response::error(403, 'forbidden', 'Platform admin only.');
            exit;
        }
        $permissions = (array) $permissions;
        if ($permissions === []) {
            return $user;
        }
        foreach ($permissions as $permission) {
            if (AdminAccess::can($user, $permission)) {
                return $user;
            }
        }
        Response::error(
            403,
            'permission_denied',
            in_array(AdminAccess::SUPER, $permissions, true) && count($permissions) === 1
                ? 'این کار فقط از عهدهٔ مدیر کل برمی‌آید.'
                : 'نقش مدیریتی شما به این بخش دسترسی ندارد.'
        );
        exit;
    }

    public static function hashPassword(string $password): string
    {
        return password_hash($password, PASSWORD_DEFAULT);
    }

    public static function verifyPassword(string $password, string $hash): bool
    {
        return password_verify($password, $hash);
    }
}
