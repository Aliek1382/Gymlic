<?php
declare(strict_types=1);

namespace Gymlic;

use PDO;
use Throwable;

/**
 * Login protection: the temporary lockout after repeated failed logins
 * (login_attempts), the SMS codes of two-step admin login (login_challenges),
 * and the rule that only a super admin may change an admin's account.
 *
 * The policy numbers live in Settings 'security'. Every database touch is
 * guarded: before security-update.sql has run, logins work exactly as they
 * did before (no lockout, no codes).
 */
final class Security
{
    public const CODE_TTL_MINUTES = 5;

    public const CODE_MAX_ATTEMPTS = 5;

    public const RESEND_AFTER_SECONDS = 60;

    private function __construct()
    {
    }

    public static function settings(): array
    {
        return Settings::get('security');
    }

    public static function ready(): bool
    {
        return Database::hasColumn('login_attempts', 'email') && Database::hasColumn('login_challenges', 'code_hash');
    }

    public static function clientIp(): ?string
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? null;
        return is_string($ip) && $ip !== '' ? substr($ip, 0, 45) : null;
    }

    // ---- Lockout ------------------------------------------------------------

    /**
     * Minutes until this email (or this IP) may try again, or null if it
     * may now. An email counts the failures since its last successful login
     * within the window; an IP counts every failure in the window, which is
     * what stops one machine guessing across many accounts.
     */
    public static function lockedMinutes(string $email, ?string $ip): ?int
    {
        if (!self::ready()) {
            return null;
        }
        $policy = self::settings();
        $window = $policy['lock_minutes'];

        try {
            $pdo = Database::connection();
            $stmt = $pdo->prepare(
                "SELECT COUNT(*) AS n, MAX(created_at) AS last_at FROM login_attempts
                 WHERE email = :email AND success = 0
                   AND created_at > NOW() - INTERVAL {$window} MINUTE
                   AND created_at > COALESCE(
                       (SELECT MAX(s.created_at) FROM login_attempts s WHERE s.email = :email2 AND s.success = 1),
                       '1970-01-01')"
            );
            $stmt->execute(['email' => $email, 'email2' => $email]);
            $row = $stmt->fetch();
            if ((int) $row['n'] >= $policy['max_attempts']) {
                return self::remaining($pdo, (string) $row['last_at'], $window);
            }

            if ($ip !== null) {
                $stmt = $pdo->prepare(
                    "SELECT COUNT(*) AS n, MAX(created_at) AS last_at FROM login_attempts
                     WHERE ip_address = :ip AND success = 0 AND created_at > NOW() - INTERVAL {$window} MINUTE"
                );
                $stmt->execute(['ip' => $ip]);
                $row = $stmt->fetch();
                if ((int) $row['n'] >= $policy['ip_max_attempts']) {
                    return self::remaining($pdo, (string) $row['last_at'], $window);
                }
            }
        } catch (Throwable $e) {
            error_log('Security::lockedMinutes: ' . $e->getMessage());
        }
        return null;
    }

    public static function recordAttempt(string $email, ?string $ip, bool $success): void
    {
        if (!self::ready()) {
            return;
        }
        try {
            $pdo = Database::connection();
            $pdo->prepare('INSERT INTO login_attempts (email, ip_address, success) VALUES (:email, :ip, :success)')
                ->execute(['email' => mb_substr($email, 0, 255), 'ip' => $ip, 'success' => $success ? 1 : 0]);
            // Keep the table small without a cron of its own.
            if (!$success) {
                $pdo->exec('DELETE FROM login_attempts WHERE created_at < NOW() - INTERVAL 30 DAY LIMIT 200');
            }
        } catch (Throwable $e) {
            error_log('Security::recordAttempt: ' . $e->getMessage());
        }
    }

    /** Lifts an email's lockout: its failures inside the window stop counting. */
    public static function unlock(string $email): int
    {
        $window = self::settings()['lock_minutes'];
        $stmt = Database::connection()->prepare(
            "DELETE FROM login_attempts WHERE email = :email AND success = 0 AND created_at > NOW() - INTERVAL {$window} MINUTE"
        );
        $stmt->execute(['email' => $email]);
        return $stmt->rowCount();
    }

    /** Lifts an IP's lockout the same way. */
    public static function unlockIp(string $ip): int
    {
        $window = self::settings()['lock_minutes'];
        $stmt = Database::connection()->prepare(
            "DELETE FROM login_attempts WHERE ip_address = :ip AND success = 0 AND created_at > NOW() - INTERVAL {$window} MINUTE"
        );
        $stmt->execute(['ip' => $ip]);
        return $stmt->rowCount();
    }

    /**
     * Emails and IPs locked right now, with minutes left.
     *
     * @return array{emails: list<array{email: string, failures: int, minutes_left: int}>, ips: list<array{ip: string, failures: int, minutes_left: int}>}
     */
    public static function currentLocks(): array
    {
        $policy = self::settings();
        $window = $policy['lock_minutes'];
        $pdo = Database::connection();

        $emails = $pdo->prepare(
            "SELECT a.email, COUNT(*) AS failures,
                    GREATEST(1, CEIL(TIMESTAMPDIFF(SECOND, NOW(), MAX(a.created_at) + INTERVAL {$window} MINUTE) / 60)) AS minutes_left
             FROM login_attempts a
             WHERE a.success = 0 AND a.created_at > NOW() - INTERVAL {$window} MINUTE
               AND a.created_at > COALESCE(
                   (SELECT MAX(s.created_at) FROM login_attempts s WHERE s.email = a.email AND s.success = 1),
                   '1970-01-01')
             GROUP BY a.email
             HAVING failures >= :max"
        );
        $emails->execute(['max' => $policy['max_attempts']]);

        $ips = $pdo->prepare(
            "SELECT ip_address AS ip, COUNT(*) AS failures,
                    GREATEST(1, CEIL(TIMESTAMPDIFF(SECOND, NOW(), MAX(created_at) + INTERVAL {$window} MINUTE) / 60)) AS minutes_left
             FROM login_attempts
             WHERE success = 0 AND ip_address IS NOT NULL AND created_at > NOW() - INTERVAL {$window} MINUTE
             GROUP BY ip_address
             HAVING failures >= :max"
        );
        $ips->execute(['max' => $policy['ip_max_attempts']]);

        return [
            'emails' => Cast::rows($emails->fetchAll(), [], ['failures', 'minutes_left']),
            'ips'    => Cast::rows($ips->fetchAll(), [], ['failures', 'minutes_left']),
        ];
    }

    private static function remaining(PDO $pdo, string $lastAt, int $window): int
    {
        $stmt = $pdo->prepare('SELECT GREATEST(1, CEIL(TIMESTAMPDIFF(SECOND, NOW(), :last + INTERVAL ' . $window . ' MINUTE) / 60))');
        $stmt->execute(['last' => $lastAt]);
        return (int) $stmt->fetchColumn();
    }

    // ---- Two-step admin login -------------------------------------------------

    /** Whether this user must enter an SMS code after the password. */
    public static function twoFactorRequired(array $user): bool
    {
        return self::ready() && self::settings()['admin_2fa'] && AdminAccess::of($user) !== null;
    }

    /**
     * Creates a challenge and texts its code. Returns [challenge id, null] or
     * [null, why it could not be sent].
     *
     * @return array{0: ?string, 1: ?string}
     */
    public static function startChallenge(array $user, string $purpose): array
    {
        $phone = SmsGateway::normalizePhone((string) ($user['phone'] ?? ''));
        if ($phone === null) {
            return [null, 'برای این حساب شمارهٔ موبایل معتبری ثبت نشده است.'];
        }

        $pdo = Database::connection();
        // One live challenge per user and purpose.
        $pdo->prepare('DELETE FROM login_challenges WHERE user_id = :user AND purpose = :purpose')
            ->execute(['user' => $user['id'], 'purpose' => $purpose]);

        $code = self::newCode();
        $id = Uuid::v4();
        $pdo->prepare(
            'INSERT INTO login_challenges (id, user_id, purpose, code_hash, expires_at)
             VALUES (:id, :user, :purpose, :hash, NOW() + INTERVAL ' . self::CODE_TTL_MINUTES . ' MINUTE)'
        )->execute(['id' => $id, 'user' => $user['id'], 'purpose' => $purpose, 'hash' => password_hash($code, PASSWORD_DEFAULT)]);

        if (!SmsGateway::send($phone, self::codeText($code))) {
            $pdo->prepare('DELETE FROM login_challenges WHERE id = :id')->execute(['id' => $id]);
            return [null, 'ارسال پیامک کد ناموفق بود (' . SmsGateway::lastError() . ').'];
        }
        return [$id, null];
    }

    /** A fresh code for the same challenge, at most once a minute. Returns an error, or null. */
    public static function resendChallenge(string $id, string $purpose): ?string
    {
        $pdo = Database::connection();
        $stmt = $pdo->prepare(
            'SELECT c.user_id, p.phone, TIMESTAMPDIFF(SECOND, c.last_sent_at, NOW()) AS since
             FROM login_challenges c JOIN profiles p ON p.id = c.user_id
             WHERE c.id = :id AND c.purpose = :purpose AND c.expires_at > NOW()'
        );
        $stmt->execute(['id' => $id, 'purpose' => $purpose]);
        $row = $stmt->fetch();
        if ($row === false) {
            return 'این کد منقضی شده است. دوباره وارد شوید.';
        }
        if ((int) $row['since'] < self::RESEND_AFTER_SECONDS) {
            return 'برای ارسال دوبارهٔ کد کمی صبر کنید.';
        }

        $code = self::newCode();
        $pdo->prepare(
            'UPDATE login_challenges SET code_hash = :hash, last_sent_at = NOW(),
               expires_at = NOW() + INTERVAL ' . self::CODE_TTL_MINUTES . ' MINUTE
             WHERE id = :id'
        )->execute(['hash' => password_hash($code, PASSWORD_DEFAULT), 'id' => $id]);

        $phone = SmsGateway::normalizePhone((string) $row['phone']);
        if ($phone === null || !SmsGateway::send($phone, self::codeText($code))) {
            return 'ارسال پیامک کد ناموفق بود.';
        }
        return null;
    }

    /**
     * Checks a code. Returns [user id, null] on success (the challenge is
     * then used up), or [null, error]. Each wrong code counts against the
     * challenge, and a challenge that runs out of tries is deleted.
     *
     * @return array{0: ?string, 1: ?string}
     */
    public static function verifyChallenge(string $id, string $purpose, string $code): array
    {
        $pdo = Database::connection();
        $stmt = $pdo->prepare(
            'SELECT user_id, code_hash, attempts FROM login_challenges
             WHERE id = :id AND purpose = :purpose AND expires_at > NOW()'
        );
        $stmt->execute(['id' => $id, 'purpose' => $purpose]);
        $row = $stmt->fetch();
        if ($row === false) {
            return [null, 'این کد منقضی شده است. دوباره وارد شوید.'];
        }

        $code = strtr(trim($code), ['۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4', '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9']);
        if (!password_verify($code, (string) $row['code_hash'])) {
            $attempts = (int) $row['attempts'] + 1;
            if ($attempts >= self::CODE_MAX_ATTEMPTS) {
                $pdo->prepare('DELETE FROM login_challenges WHERE id = :id')->execute(['id' => $id]);
                return [null, 'کد چند بار اشتباه وارد شد. دوباره وارد شوید تا کد تازه بگیرید.'];
            }
            $pdo->prepare('UPDATE login_challenges SET attempts = :n WHERE id = :id')->execute(['n' => $attempts, 'id' => $id]);
            return [null, 'کد واردشده درست نیست.'];
        }

        $pdo->prepare('DELETE FROM login_challenges WHERE id = :id')->execute(['id' => $id]);
        return [(string) $row['user_id'], null];
    }

    /** "0912***4567" for the code screen. */
    public static function phoneHint(?string $phone): string
    {
        $normalized = SmsGateway::normalizePhone((string) $phone);
        return $normalized === null ? '' : substr($normalized, 0, 4) . '***' . substr($normalized, -4);
    }

    /**
     * Admin accounts without a usable mobile number — each would be locked
     * out by two-step login, so it can't be switched on while any exist.
     *
     * @return list<array{id: string, name: string}>
     */
    public static function adminsWithoutPhone(): array
    {
        $where = 'is_platform_admin = 1' . (AdminAccess::rolesReady() ? ' OR admin_role_id IS NOT NULL' : '');
        $rows = Database::connection()->query(
            "SELECT id, phone, CONCAT_WS(' ', first_name, last_name) AS name, email FROM profiles WHERE {$where}"
        )->fetchAll();

        $out = [];
        foreach ($rows as $row) {
            if (SmsGateway::normalizePhone((string) $row['phone']) === null) {
                $out[] = ['id' => $row['id'], 'name' => trim((string) $row['name']) !== '' ? $row['name'] : (string) $row['email']];
            }
        }
        return $out;
    }

    // ---- Changing other accounts ---------------------------------------------

    /**
     * The account an admin action targets. Ends the request with 404 if it
     * doesn't exist, and with 403 if it is an admin's account and the actor
     * isn't a super admin: a staff role that could reset an admin's password
     * or sign them out could take over the super admin's account.
     */
    public static function targetFor(array $actor, string $targetId): array
    {
        $columns = 'id, email, phone, account_type, is_platform_admin'
            . (AdminAccess::rolesReady() ? ', admin_role_id' : '');
        $stmt = Database::connection()->prepare("SELECT {$columns} FROM profiles WHERE id = :id");
        $stmt->execute(['id' => $targetId]);
        $target = $stmt->fetch();
        if ($target === false) {
            Response::error(404, 'not_found', 'این کاربر پیدا نشد.');
            exit;
        }
        if (AdminAccess::isAdminAccount($target) && !AdminAccess::can($actor, AdminAccess::SUPER)) {
            Response::error(403, 'admin_target', 'حساب مدیران را فقط مدیر کل می‌تواند تغییر دهد.');
            exit;
        }
        return $target;
    }

    private static function newCode(): string
    {
        return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    }

    private static function codeText(string $code): string
    {
        return "کد ورود جیم‌لیک: {$code}\nاین کد را به هیچ‌کس ندهید.";
    }
}
