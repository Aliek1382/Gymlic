<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\AdminAccess;
use Gymlic\Auth;
use Gymlic\Cast;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Security;
use Gymlic\Settings;
use Gymlic\SmsGateway;
use Gymlic\Validate;
use Throwable;

/**
 * /admin/security: the lockout policy, accounts and IPs locked right now,
 * recent failed logins, and switching two-step admin login on — only after
 * a code texted to the admin's own phone proves SMS works and they won't be
 * locked out. Super admin only.
 */
final class SecurityController
{
    public static function overview(): void
    {
        $admin = Auth::requireAdmin(AdminAccess::SUPER);
        $ready = Security::ready();
        $sms = SmsGateway::credentials();

        $recent = [];
        $locks = ['emails' => [], 'ips' => []];
        if ($ready) {
            try {
                $recent = Database::connection()->query(
                    'SELECT email, ip_address, created_at FROM login_attempts
                     WHERE success = 0 ORDER BY created_at DESC LIMIT 100'
                )->fetchAll();
                $locks = Security::currentLocks();
            } catch (Throwable $e) {
                error_log('SecurityController::overview: ' . $e->getMessage());
            }
        }

        Response::ok([
            'ready'                => $ready,
            'settings'             => Security::settings(),
            'sms_ready'            => $sms['api_key'] !== '' && $sms['sender'] !== '',
            'admins_without_phone' => Security::adminsWithoutPhone(),
            'my_phone_hint'        => Security::phoneHint($admin['phone'] ?? null),
            'locked'               => $locks,
            'recent_failures'      => $recent,
            'code_ttl_minutes'     => Security::CODE_TTL_MINUTES,
        ]);
    }

    /** Step 1 of switching two-step login on: text a code to this admin. */
    public static function start2fa(): void
    {
        $admin = Auth::requireAdmin(AdminAccess::SUPER);

        if (!Security::ready()) {
            Response::error(503, 'schema_missing', 'اول به‌روزرسانی دیتابیس «فاز ۵» را اجرا کنید.');
            return;
        }
        $sms = SmsGateway::credentials();
        if ($sms['api_key'] === '' || $sms['sender'] === '') {
            Response::error(409, 'sms_not_ready', 'پیامک تنظیم نشده است؛ اول کلید و خط پیامک را در «تنظیمات سایت» وارد کنید.');
            return;
        }
        $missing = Security::adminsWithoutPhone();
        if ($missing !== []) {
            $names = implode('، ', array_column($missing, 'name'));
            Response::error(409, 'admins_without_phone', "این مدیران شمارهٔ موبایل معتبر ندارند و بعد از روشن‌شدن نمی‌توانند وارد شوند: {$names}");
            return;
        }

        [$challengeId, $error] = Security::startChallenge($admin, 'enable_2fa');
        if ($challengeId === null) {
            Response::error(502, 'sms_failed', $error ?? 'ارسال کد ناموفق بود.');
            return;
        }
        Response::ok(['challenge_id' => $challengeId, 'phone_hint' => Security::phoneHint($admin['phone'])]);
    }

    /** Step 2: the code proves SMS reaches this admin; then it is switched on. */
    public static function confirm2fa(): void
    {
        $admin = Auth::requireAdmin(AdminAccess::SUPER);
        $data = Validate::required(Validate::body(), ['challenge_id', 'code']);

        [$userId, $error] = Security::verifyChallenge((string) $data['challenge_id'], 'enable_2fa', (string) $data['code']);
        if ($userId === null || $userId !== $admin['id']) {
            Response::error(400, 'invalid_code', $error ?? 'کد واردشده درست نیست.');
            return;
        }

        Settings::save('security', ['admin_2fa' => true] + Security::settings(), $admin['id']);
        AdminController::logActivity(Database::connection(), null, $admin['id'], null, 'two_factor_enabled', []);
        Response::ok(['ok' => true]);
    }

    /** Body: {email} or {ip}. */
    public static function unlock(): void
    {
        $admin = Auth::requireAdmin(AdminAccess::SUPER);
        $data = Validate::body();

        $email = strtolower(trim((string) ($data['email'] ?? '')));
        $ip = trim((string) ($data['ip'] ?? ''));
        if ($email === '' && $ip === '') {
            Response::error(400, 'missing_fields', 'Missing required field(s): email or ip');
            return;
        }

        $count = $email !== '' ? Security::unlock($email) : Security::unlockIp($ip);
        AdminController::logActivity(Database::connection(), null, $admin['id'], null, 'login_unlocked', [
            'email' => $email !== '' ? $email : null,
            'ip'    => $ip !== '' ? $ip : null,
        ]);
        Response::ok(['cleared' => $count]);
    }
}
