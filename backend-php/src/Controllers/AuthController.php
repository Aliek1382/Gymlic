<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\AdminAccess;
use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Security;
use Gymlic\Settings;
use Gymlic\Uuid;
use Gymlic\Validate;
use Gymlic\TelegramAlerts;
use Gymlic\Templates;
use Gymlic\Tiers;
use Gymlic\TrainerVerification;
use PDO;

final class AuthController
{
    private static function profilePublic(array $p): array
    {
        return [
            'id'                => $p['id'],
            'email'             => $p['email'],
            'phone'             => $p['phone'],
            'first_name'        => $p['first_name'],
            'last_name'         => $p['last_name'],
            'avatar_url'        => $p['avatar_url'],
            'account_type'      => $p['account_type'],
            'birth_date'        => $p['birth_date'],
            'daily_calorie_goal' => isset($p['daily_calorie_goal']) ? (int) $p['daily_calorie_goal'] : null,
            'protein_percent'   => isset($p['protein_percent']) ? (int) $p['protein_percent'] : null,
            'carbs_percent'     => isset($p['carbs_percent']) ? (int) $p['carbs_percent'] : null,
            'fat_percent'       => isset($p['fat_percent']) ? (int) $p['fat_percent'] : null,
            'is_platform_admin' => (bool) $p['is_platform_admin'],
            'notify_sms'        => (bool) ($p['notify_sms'] ?? 0),
            'notify_email'      => (bool) ($p['notify_email'] ?? 0),
        ];
    }

    public static function signup(): void
    {
        $data = Validate::required(Validate::body(), ['email', 'password']);
        $email = strtolower(trim((string) $data['email']));
        $password = (string) $data['password'];

        if (!Validate::email($email)) {
            Response::error(400, 'invalid_email', 'Enter a valid email address.');
            return;
        }
        if (strlen($password) < 8) {
            Response::error(400, 'weak_password', 'Password must be at least 8 characters.');
            return;
        }

        $pdo = Database::connection();

        // With sign-up closed by the admin, only someone holding a live
        // invitation may still create an account — invitees are how clubs and
        // trainers bring people in, and that must keep working.
        if (!Settings::get('signup')['open'] && !self::hasPendingInvitation($pdo, (string) ($data['invitation_code'] ?? ''))) {
            Response::error(403, 'signup_closed', 'ثبت‌نام در حال حاضر بسته است. اگر لینک دعوت دارید، از همان لینک وارد شوید.');
            return;
        }

        $exists = $pdo->prepare('SELECT id FROM profiles WHERE email = :email');
        $exists->execute(['email' => $email]);
        if ($exists->fetch() !== false) {
            Response::error(409, 'email_taken', 'An account with this email already exists.');
            return;
        }

        $id = Uuid::v4();
        $stmt = $pdo->prepare(
            'INSERT INTO profiles (id, email, password_hash, first_name, last_name)
             VALUES (:id, :email, :hash, :first_name, :last_name)'
        );
        $stmt->execute([
            'id'         => $id,
            'email'      => $email,
            'hash'       => Auth::hashPassword($password),
            'first_name' => Validate::nullableString($data['first_name'] ?? null),
            'last_name'  => Validate::nullableString($data['last_name'] ?? null),
        ]);

        $session = Auth::createSession($id);
        $user = self::fetchProfile($id);

        Response::ok(['token' => $session['token'], 'user' => self::profilePublic($user)], 201);
    }

    /**
     * Email + password. Repeated failures lock the email (and the IP) for a
     * while — see Security. For an admin with two-step login on, a correct
     * password doesn't sign in yet: it texts a code and answers
     * {two_factor: {...}}; /auth/login/verify finishes the login.
     */
    public static function login(): void
    {
        $data = Validate::required(Validate::body(), ['email', 'password']);
        $email = strtolower(trim((string) $data['email']));
        $ip = Security::clientIp();

        $locked = Security::lockedMinutes($email, $ip);
        if ($locked !== null) {
            self::lockedResponse($locked);
            return;
        }

        $pdo = Database::connection();
        $stmt = $pdo->prepare('SELECT * FROM profiles WHERE email = :email');
        $stmt->execute(['email' => $email]);
        $user = $stmt->fetch();

        if ($user === false || !Auth::verifyPassword((string) $data['password'], $user['password_hash'])) {
            Security::recordAttempt($email, $ip, false);
            Response::error(401, 'invalid_credentials', 'Incorrect email or password.');
            return;
        }
        if ((int) $user['is_suspended'] === 1) {
            Response::error(403, 'account_suspended', 'This account has been suspended.');
            return;
        }

        if (Security::twoFactorRequired($user)) {
            [$challengeId, $error] = Security::startChallenge($user, 'login');
            if ($challengeId === null) {
                Response::error(503, 'two_factor_unavailable', 'ورود دومرحله‌ای برای مدیران روشن است ولی کد ارسال نشد: ' . $error);
                return;
            }
            // Not a success yet: the lockout keeps counting until the code is right.
            Response::ok(['two_factor' => [
                'challenge_id' => $challengeId,
                'phone_hint'   => Security::phoneHint($user['phone']),
                'expires_in'   => Security::CODE_TTL_MINUTES * 60,
                'resend_after' => Security::RESEND_AFTER_SECONDS,
            ]]);
            return;
        }

        Security::recordAttempt($email, $ip, true);
        $session = Auth::createSession($user['id']);
        Response::ok(['token' => $session['token'], 'user' => self::profilePublic($user)]);
    }

    /** The second step of an admin login: the texted code. */
    public static function verifyLogin(): void
    {
        $data = Validate::required(Validate::body(), ['challenge_id', 'code']);
        $pdo = Database::connection();

        $owner = $pdo->prepare(
            "SELECT p.* FROM login_challenges c JOIN profiles p ON p.id = c.user_id WHERE c.id = :id AND c.purpose = 'login'"
        );
        $owner->execute(['id' => (string) $data['challenge_id']]);
        $user = $owner->fetch();
        if ($user === false) {
            Response::error(410, 'challenge_expired', 'این کد منقضی شده است. دوباره وارد شوید.');
            return;
        }

        $email = strtolower((string) $user['email']);
        $ip = Security::clientIp();
        $locked = Security::lockedMinutes($email, $ip);
        if ($locked !== null) {
            self::lockedResponse($locked);
            return;
        }

        [$userId, $error] = Security::verifyChallenge((string) $data['challenge_id'], 'login', (string) $data['code']);
        if ($userId === null) {
            Security::recordAttempt($email, $ip, false);
            Response::error(401, 'invalid_code', $error ?? 'کد واردشده درست نیست.');
            return;
        }
        if ((int) $user['is_suspended'] === 1) {
            Response::error(403, 'account_suspended', 'This account has been suspended.');
            return;
        }

        Security::recordAttempt($email, $ip, true);
        $session = Auth::createSession($userId);
        Response::ok(['token' => $session['token'], 'user' => self::profilePublic($user)]);
    }

    public static function resendLoginCode(): void
    {
        $data = Validate::required(Validate::body(), ['challenge_id']);
        $error = Security::resendChallenge((string) $data['challenge_id'], 'login');
        if ($error !== null) {
            Response::error(429, 'resend_refused', $error);
            return;
        }
        Response::ok(['ok' => true]);
    }

    private static function lockedResponse(int $minutes): void
    {
        $persian = strtr((string) $minutes, ['0' => '۰', '1' => '۱', '2' => '۲', '3' => '۳', '4' => '۴', '5' => '۵', '6' => '۶', '7' => '۷', '8' => '۸', '9' => '۹']);
        Response::error(
            429,
            'login_locked',
            "به‌خاطر چند تلاش ناموفق پشت سر هم، ورود موقتاً قفل شده است. {$persian} دقیقهٔ دیگر دوباره امتحان کنید."
        );
    }

    public static function logout(): void
    {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (preg_match('/^Bearer\s+(\S+)$/i', $header, $m)) {
            Auth::destroySession($m[1]);
        }
        Response::ok(['ok' => true]);
    }

    /**
     * Everything the app's redirect rules need in one call: the profile, the
     * active club membership with the club's own name and status, and the
     * athlete's trainer. The browser used to assemble this from four separate
     * Supabase queries on every page load.
     */
    public static function me(): void
    {
        $user = Auth::requireUser();
        $pdo = Database::connection();

        $stmt = $pdo->prepare(
            "SELECT m.club_id, m.role, c.name AS club_name, c.status AS club_status
             FROM memberships m
             JOIN clubs c ON c.id = m.club_id
             WHERE m.user_id = :id AND m.status = 'active'
             ORDER BY m.joined_at ASC LIMIT 1"
        );
        $stmt->execute(['id' => $user['id']]);
        $membership = $stmt->fetch() ?: null;

        $stmt = $pdo->prepare(
            'SELECT p.id, p.first_name, p.last_name, p.avatar_url, ' . TrainerVerification::flagSql('p.id') . " AS is_verified
             FROM trainer_athletes ta
             JOIN profiles p ON p.id = ta.trainer_id
             WHERE ta.athlete_id = :id AND ta.status = 'active'
             ORDER BY ta.created_at ASC LIMIT 1"
        );
        $stmt->execute(['id' => $user['id']]);
        $trainer = $stmt->fetch() ?: null;
        if ($trainer !== null) {
            $trainer['is_verified'] = (bool) $trainer['is_verified'];
        }
        // The logo and watermark on a printed plan: the trainer's own, or for
        // an athlete their trainer's. Null before its database update.
        $printTrainer = $user['account_type'] === 'trainer' ? $user['id'] : ($trainer['id'] ?? null);
        $print = $printTrainer !== null ? PrintBrandingController::of($pdo, $printTrainer) : null;

        // What the panel shows of /admin: null for a regular user, and for
        // an admin's read-only view of someone's panel.
        $session = Auth::session();
        $viewAs = null;
        if (($session['impersonated_by'] ?? null) !== null) {
            $stmt = $pdo->prepare("SELECT CONCAT_WS(' ', first_name, last_name) FROM profiles WHERE id = :id");
            $stmt->execute(['id' => $session['impersonated_by']]);
            $viewAs = [
                'admin_name' => (string) ($stmt->fetchColumn() ?: ''),
                'read_only'  => $session['read_only'],
                'expires_at' => $session['expires_at'],
                // Seconds, so the browser's clock and timezone don't matter.
                'expires_in' => max(0, strtotime($session['expires_at']) - time()),
            ];
        }
        $admin = $viewAs === null ? AdminAccess::of($user) : null;

        Response::ok([
            'user'        => self::profilePublic($user) + ['is_suspended' => (bool) $user['is_suspended']],
            'admin'       => $admin === null ? null : [
                'level'       => $admin['level'],
                'role_name'   => $admin['role_name'],
                'permissions' => $admin['permissions'],
            ],
            'membership'  => $membership,
            'trainer'     => $trainer,
            'print'       => $print,
            'view_as'     => $viewAs,
            // The plan tier that decides which sections open (Tiers), and the
            // sections the admin set by hand for this account; null = not limited.
            'tier'        => self::tierInfo($pdo, $user),
        ]);
    }

    /**
     * The tier and the sections set by hand for this user's accounts
     * (AccountAccess, resolved as the API applies them); null when neither
     * limits anything.
     */
    private static function tierInfo(\PDO $pdo, array $user): ?array
    {
        $tier = Tiers::effective($pdo, $user);
        $access = Tiers::accessFor($pdo, $user);
        if ($tier === null && $access === []) {
            return null;
        }
        return [
            'key'    => $tier,
            'label'  => $tier === null ? '' : Tiers::label($tier),
            'access' => (object) $access,
        ];
    }

    public static function chooseRole(): void
    {
        $user = Auth::requireUser();
        $data = Validate::required(Validate::body(), ['account_type']);
        $role = (string) $data['account_type'];

        if (!in_array($role, ['club', 'trainer', 'athlete'], true)) {
            Response::error(400, 'invalid_role', 'account_type must be club, trainer, or athlete.');
            return;
        }

        $pdo = Database::connection();
        $wasUnset = $user['account_type'] === null;

        // A role the admin closed to self sign-up can't be picked here; an
        // invitation assigns its role through its own endpoint instead.
        if ($wasUnset && !Settings::get('signup')['roles'][$role] && (int) $user['is_platform_admin'] !== 1) {
            Response::error(403, 'role_closed', 'ثبت‌نام با این نقش در حال حاضر بسته است.');
            return;
        }

        $stmt = $pdo->prepare(
            'UPDATE profiles SET account_type = :role,
               first_name = COALESCE(:first_name, first_name),
               last_name = COALESCE(:last_name, last_name)
             WHERE id = :id'
        );
        $body = Validate::body();
        $stmt->execute([
            'role'       => $role,
            'first_name' => Validate::nullableString($body['first_name'] ?? null),
            'last_name'  => Validate::nullableString($body['last_name'] ?? null),
            'id'         => $user['id'],
        ]);

        if ($wasUnset && $role !== 'club') {
            Templates::notify($pdo, 'complete_profile', $user['id'], $user['id'], 'complete_profile', [], '/settings');
        }
        if ($wasUnset && $role === 'trainer') {
            // The names just saved are in $body; $user still has the old row.
            TelegramAlerts::newAccount('trainer', [
                'first_name' => Validate::nullableString($body['first_name'] ?? null) ?? $user['first_name'],
                'last_name'  => Validate::nullableString($body['last_name'] ?? null) ?? $user['last_name'],
                'phone'      => $user['phone'],
                'email'      => $user['email'],
            ]);
        }

        Response::ok(['user' => self::profilePublic(self::fetchProfile($user['id']))]);
    }

    public static function invitationPreview(): void
    {
        $code = (string) ($_GET['code'] ?? '');
        if ($code === '') {
            Response::error(400, 'missing_code', 'code query parameter is required.');
            return;
        }

        $pdo = Database::connection();
        $stmt = $pdo->prepare(
            "SELECT i.first_name, i.last_name, i.invited_role, c.name AS club_name
             FROM invitations i
             LEFT JOIN clubs c ON c.id = i.club_id
             WHERE i.code = :code AND i.status = 'pending' AND i.expires_at > NOW()"
        );
        $stmt->execute(['code' => $code]);
        $row = $stmt->fetch();

        if ($row === false) {
            Response::error(404, 'invitation_not_found', 'This invitation is invalid or has expired.');
            return;
        }

        Response::ok($row);
    }

    private static function hasPendingInvitation(PDO $pdo, string $code): bool
    {
        if ($code === '') {
            return false;
        }
        $stmt = $pdo->prepare(
            "SELECT 1 FROM invitations WHERE code = :code AND status = 'pending' AND expires_at > NOW()"
        );
        $stmt->execute(['code' => $code]);
        return $stmt->fetch() !== false;
    }

    private static function fetchProfile(string $id): array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM profiles WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public static function notify(PDO $pdo, string $recipientId, ?string $actorId, string $type, string $title, ?string $body, ?string $link, array $metadata = []): void
    {
        $stmt = $pdo->prepare(
            'INSERT INTO notifications (id, recipient_id, actor_id, type, title, body, link, metadata)
             VALUES (:id, :recipient_id, :actor_id, :type, :title, :body, :link, :metadata)'
        );
        $id = Uuid::v4();
        $stmt->execute([
            'id'           => $id,
            'recipient_id' => $recipientId,
            'actor_id'     => $actorId,
            'type'         => $type,
            'title'        => $title,
            'body'         => $body,
            'link'         => $link,
            'metadata'     => json_encode($metadata, JSON_UNESCAPED_UNICODE),
        ]);

        // Also a phone/desktop push, sent after the response (see PushController).
        PushController::queueAfterResponse($id);

        self::queueChannels($pdo, $id, $recipientId);
    }

    /**
     * SMS / email copies of a notification, for a recipient who opted in. Only
     * queues rows in notification_deliveries; cron/notification-dispatch.php
     * sends them, so the request that raised the notification never waits on
     * a provider. Must never break the caller (and must not, if the columns
     * are not there yet), hence the catch.
     */
    private static function queueChannels(PDO $pdo, string $notificationId, string $recipientId): void
    {
        try {
            $stmt = $pdo->prepare('SELECT phone, email, notify_sms, notify_email FROM profiles WHERE id = :id');
            $stmt->execute(['id' => $recipientId]);
            $p = $stmt->fetch();
            if ($p === false) {
                return;
            }

            $insert = $pdo->prepare(
                'INSERT INTO notification_deliveries (id, notification_id, channel) VALUES (:id, :notification_id, :channel)'
            );
            if ((int) $p['notify_sms'] === 1 && trim((string) $p['phone']) !== '') {
                $insert->execute(['id' => Uuid::v4(), 'notification_id' => $notificationId, 'channel' => 'sms']);
            }
            if ((int) $p['notify_email'] === 1 && trim((string) $p['email']) !== '') {
                $insert->execute(['id' => Uuid::v4(), 'notification_id' => $notificationId, 'channel' => 'email']);
            }
        } catch (\Throwable $e) {
            error_log('notify channels: ' . $e->getMessage());
        }
    }
}
