<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\Features;
use Gymlic\Response;
use Gymlic\Settings;
use Gymlic\Validate;
use Throwable;

/**
 * The admin's site settings: read by every visitor (only the public groups),
 * and read/written by the platform admin from /admin.
 */
final class SettingsController
{
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
        Auth::requirePlatformAdmin();

        $settings = [];
        foreach (Settings::KEYS as $key) {
            $settings[$key] = Settings::get($key);
        }

        Response::ok([
            'settings'        => $settings,
            'feature_catalog' => Features::catalog(),
            'storage_ready'   => Settings::storageReady(),
        ]);
    }

    /** Replaces one settings group. Body: {"value": {...}}. */
    public static function adminUpdate(array $params): void
    {
        $admin = Auth::requirePlatformAdmin();
        $key = $params['key'];

        if (!in_array($key, Settings::KEYS, true)) {
            Response::error(404, 'unknown_setting', 'این گروه تنظیمات وجود ندارد.');
            return;
        }

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

        try {
            $saved = Settings::save($key, $body['value'], $admin['id']);
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

        Response::ok(['value' => $saved]);
    }
}
