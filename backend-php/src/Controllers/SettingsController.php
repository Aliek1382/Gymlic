<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\AdminAccess;
use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\Features;
use Gymlic\MailGateway;
use Gymlic\Response;
use Gymlic\Settings;
use Gymlic\SmsGateway;
use Gymlic\Templates;
use Gymlic\Validate;
use Throwable;

/**
 * The admin's site settings: read by every visitor (only the public groups),
 * and read/written by the platform admin from /admin.
 */
final class SettingsController
{
    /** The permission each settings group needs; anything not listed is super admin only. */
    private const KEY_PERMISSION = [
        'maintenance'   => 'settings',
        'signup'        => 'settings',
        'announcement'  => 'settings',
        'support'       => 'settings',
        'features'      => 'settings',
        'limits'        => 'settings',
        'points_levels' => 'content',
        'billing'       => 'finance',
        'templates'     => 'notifications',
        'branding'      => 'settings',
        'reports'       => 'settings',
        'tiers'         => 'finance',
    ];

    /**
     * What the frontend needs before it can decide what to show: whether the
     * site is in maintenance, whether sign-up is open, the banner, the support
     * contact and which sections are on. No session needed — the login page
     * reads it too.
     */
    public static function publicSettings(): void
    {
        $out = [];
        foreach (Settings::PUBLIC_KEYS as $key) {
            $out[$key] = Settings::get($key);
        }

        // An off banner's old text is nobody's business.
        if (!$out['announcement']['enabled']) {
            $out['announcement']['message'] = '';
        }

        Response::ok($out);
    }

    public static function adminGet(): void
    {
        $admin = Auth::requireAdmin('settings');

        // A limited role never even sees the masked SMS/email credentials.
        $settings = [];
        foreach (Settings::KEYS as $key) {
            if (AdminAccess::can($admin, self::KEY_PERMISSION[$key] ?? AdminAccess::SUPER)) {
                $settings[$key] = self::masked($key, Settings::get($key));
            }
        }

        $sms = SmsGateway::credentials();
        $mail = MailGateway::config();

        Response::ok([
            'settings'        => $settings,
            'feature_catalog' => Features::catalog(),
            'template_catalog' => Templates::catalog(),
            'template_groups' => Templates::GROUPS,
            'storage_ready'   => Settings::storageReady(),
            // What is actually in effect, wherever it comes from.
            'delivery'        => [
                'sms_api_key' => $sms['api_key_source'],
                'sms_sender'  => $sms['sender_source'],
                'mail'        => $mail['source'],
            ],
            // The host's own ceiling: no limit set here can exceed it.
            'server'          => [
                'upload_max_mb' => self::iniMegabytes('upload_max_filesize'),
                'post_max_mb'   => self::iniMegabytes('post_max_size'),
            ],
        ]);
    }

    /** Replaces one settings group. Body: {"value": {...}}. */
    public static function adminUpdate(array $params): void
    {
        $admin = Auth::requireAdmin(['settings', 'content', 'finance', 'notifications']);
        $key = $params['key'];

        if (!in_array($key, Settings::KEYS, true)) {
            Response::error(404, 'unknown_setting', 'این گروه تنظیمات وجود ندارد.');
            return;
        }
        $admin = Auth::requireAdmin(self::KEY_PERMISSION[$key] ?? AdminAccess::SUPER);

        $body = Validate::body();
        if (!array_key_exists('value', $body) || !is_array($body['value'])) {
            Response::error(400, 'missing_fields', 'Missing required field(s): value');
            return;
        }

        if ($key === 'support' && ($body['value']['email'] ?? '') !== ''
            && !Validate::email(trim((string) $body['value']['email']))) {
            Response::error(400, 'invalid_email', 'ایمیل پشتیبانی معتبر نیست.');
            return;
        }

        if ($key === 'billing') {
            $error = self::billingError($body['value']);
            if ($error !== null) {
                Response::error(400, 'invalid_billing', $error);
                return;
            }
        }

        if ($key === 'reports') {
            $raw = $body['value']['recipients'] ?? [];
            $items = is_array($raw) ? $raw : preg_split('/[\s,،;]+/u', (string) $raw);
            foreach ($items ?: [] as $item) {
                $item = trim((string) $item);
                if ($item !== '' && filter_var($item, FILTER_VALIDATE_EMAIL) === false) {
                    Response::error(400, 'invalid_email', "«{$item}» ایمیل معتبری نیست.");
                    return;
                }
            }
        }

        if ($key === 'branding') {
            // The logo has its own upload (BrandingController); a save of
            // the name and color leaves it as it is.
            $body['value']['logo_url'] = Settings::get('branding')['logo_url'];
            $color = $body['value']['primary_color'] ?? '';
            if ($color !== '' && (!is_string($color) || preg_match('/^#[0-9a-f]{6}$/i', $color) !== 1)) {
                Response::error(400, 'invalid_color', 'رنگ باید به شکل #RRGGBB باشد.');
                return;
            }
            if ($color !== '' && self::contrastWithWhite($color) < 3.0) {
                Response::error(
                    400,
                    'color_too_light',
                    'این رنگ روی زمینهٔ سفید خوانا نیست (متن و دکمه‌ها کم‌رنگ دیده می‌شوند). رنگ تیره‌تری انتخاب کنید.'
                );
                return;
            }
        }

        // Two-step login is only switched on through its own flow, which
        // proves an SMS code reaches the admin first (SecurityController).
        if ($key === 'security' && !empty($body['value']['admin_2fa']) && !Settings::get('security')['admin_2fa']) {
            Response::error(409, 'use_2fa_flow', 'ورود دومرحله‌ای را از صفحهٔ «امنیت» و با تأیید کد پیامکی روشن کنید.');
            return;
        }

        $value = self::keepSecrets($key, $body['value'], $body['clear_secrets'] ?? []);

        try {
            $saved = Settings::save($key, $value, $admin['id']);
        } catch (Throwable $e) {
            error_log('Settings::save failed: ' . $e->getMessage());
            Response::error(
                503,
                'settings_storage_missing',
                'جدول تنظیمات هنوز در دیتابیس ساخته نشده است. دستور app-settings-update.sql را در phpMyAdmin اجرا کنید.'
            );
            return;
        }

        AdminController::logActivity(Database::connection(), null, $admin['id'], null, 'settings_updated', [
            'key' => $key,
        ]);

        Response::ok(['value' => self::masked($key, $saved)]);
    }

    /**
     * A typo in the card number or IBAN would send clubs' money nowhere, so
     * both are checked before saving: the card with the Luhn digit every
     * Iranian bank card carries, the IBAN with its ISO 7064 check digits.
     */
    private static function billingError(array $value): ?string
    {
        $card = Settings::digits($value['card_number'] ?? '', 30);
        if ($card !== '' && (strlen($card) !== 16 || !self::luhn($card))) {
            return 'شمارهٔ کارت معتبر نیست؛ ۱۶ رقم کارت را دوباره بررسی کنید.';
        }

        $sheba = Settings::digits($value['sheba'] ?? '', 30);
        if ($sheba !== '' && (strlen($sheba) !== 24 || !self::ibanValid('IR' . $sheba))) {
            return 'شمارهٔ شبا معتبر نیست؛ باید IR و ۲۴ رقم باشد.';
        }

        return null;
    }

    /**
     * WCAG contrast of a #rrggbb color against white. The main color is
     * also the color of links and outlined text on white, so it needs at
     * least 3:1 (what WCAG asks of large text and controls).
     */
    public static function contrastWithWhite(string $hex): float
    {
        $channel = static function (string $pair): float {
            $c = hexdec($pair) / 255;
            return $c <= 0.03928 ? $c / 12.92 : (($c + 0.055) / 1.055) ** 2.4;
        };
        $l = 0.2126 * $channel(substr($hex, 1, 2)) + 0.7152 * $channel(substr($hex, 3, 2)) + 0.0722 * $channel(substr($hex, 5, 2));
        return 1.05 / ($l + 0.05);
    }

    private static function luhn(string $digits): bool
    {
        $sum = 0;
        $length = strlen($digits);
        for ($i = 0; $i < $length; $i++) {
            $d = (int) $digits[$length - 1 - $i];
            if ($i % 2 === 1) {
                $d *= 2;
                if ($d > 9) {
                    $d -= 9;
                }
            }
            $sum += $d;
        }
        return $sum % 10 === 0;
    }

    private static function ibanValid(string $iban): bool
    {
        // Country and check digits move to the end, letters become 10..35,
        // and the whole number mod 97 must be 1 (done in chunks: it is 26+ digits).
        $moved = substr($iban, 4) . substr($iban, 0, 4);
        $numeric = '';
        foreach (str_split($moved) as $char) {
            $numeric .= ctype_alpha($char) ? (string) (ord(strtoupper($char)) - 55) : $char;
        }
        $remainder = 0;
        foreach (str_split($numeric, 7) as $chunk) {
            $remainder = (int) ($remainder . $chunk) % 97;
        }
        return $remainder === 1;
    }

    /** Sends one SMS through whatever is configured, and says why not if it fails. */
    public static function testSms(): void
    {
        Auth::requireAdmin(AdminAccess::SUPER);
        $data = Validate::required(Validate::body(), ['phone']);

        if (SmsGateway::send((string) $data['phone'], 'پیامک آزمایشی جیم‌لیک: تنظیمات پیامک درست کار می‌کند.')) {
            Response::ok(['ok' => true]);
            return;
        }
        Response::error(502, 'sms_failed', 'ارسال پیامک ناموفق بود: ' . SmsGateway::lastError());
    }

    public static function testMail(): void
    {
        Auth::requireAdmin(AdminAccess::SUPER);
        $data = Validate::required(Validate::body(), ['email']);

        $sent = MailGateway::send(
            (string) $data['email'],
            'ایمیل آزمایشی جیم‌لیک',
            "این یک ایمیل آزمایشی از پنل مدیریت جیم‌لیک است.\nاگر آن را می‌بینید، تنظیمات ایمیل درست کار می‌کند."
        );
        if ($sent) {
            Response::ok(['ok' => true]);
            return;
        }
        Response::error(502, 'mail_failed', 'ارسال ایمیل ناموفق بود: ' . MailGateway::lastError());
    }

    /**
     * A credential is never sent back: the field comes back empty, with
     * `<field>_set` and the last 4 characters as `<field>_hint`.
     */
    private static function masked(string $key, array $value): array
    {
        foreach (Settings::SECRETS[$key] ?? [] as $field) {
            $secret = (string) $value[$field];
            $value[$field] = '';
            $value[$field . '_set'] = $secret !== '';
            $value[$field . '_hint'] = $secret !== '' ? '…' . mb_substr($secret, -4) : '';
        }
        return $value;
    }

    /**
     * The admin screen never has a stored credential to send back, so an
     * empty one means "unchanged"; clearing one is asked for by name in
     * clear_secrets.
     */
    private static function keepSecrets(string $key, array $value, mixed $clear): array
    {
        $clear = is_array($clear) ? $clear : [];
        $stored = Settings::get($key);
        foreach (Settings::SECRETS[$key] ?? [] as $field) {
            if (in_array($field, $clear, true)) {
                $value[$field] = '';
            } elseif (trim((string) ($value[$field] ?? '')) === '') {
                $value[$field] = $stored[$field];
            }
        }
        return $value;
    }

    private static function iniMegabytes(string $name): ?float
    {
        $raw = trim((string) ini_get($name));
        if ($raw === '' || !preg_match('/^(\d+(?:\.\d+)?)\s*([KMG]?)/i', $raw, $m)) {
            return null;
        }
        $bytes = (float) $m[1] * match (strtoupper($m[2])) {
            'G' => 1024 ** 3,
            'M' => 1024 ** 2,
            'K' => 1024,
            default => 1,
        };
        return round($bytes / 1024 / 1024, 1);
    }
}
