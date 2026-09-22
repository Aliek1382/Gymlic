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

    /** Returns the authenticated profile row, or null if no/invalid/expired token. */
    public static function currentUser(): ?array
    {
        $token = self::bearerToken();
        if ($token === null) {
            return null;
        }

        $pdo = Database::connection();
        $stmt = $pdo->prepare(
            'SELECT p.* FROM sessions s
             JOIN profiles p ON p.id = s.user_id
             WHERE s.token = :token AND s.expires_at > NOW()'
        );
        $stmt->execute(['token' => $token]);
        $user = $stmt->fetch();

        return $user ?: null;
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

    public static function requirePlatformAdmin(): array
    {
        $user = self::requireUser();
        if ((int) $user['is_platform_admin'] !== 1) {
            Response::error(403, 'forbidden', 'Platform admin only.');
            exit;
        }
        return $user;
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
