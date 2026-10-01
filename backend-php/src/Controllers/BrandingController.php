<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Settings;
use Gymlic\Uuid;
use Throwable;

/**
 * The logo of the "branding" settings group: uploaded here into
 * uploads/branding and stored as its logo_url. The name and the color are
 * ordinary settings (PUT /admin/settings/branding).
 *
 * No SVG: it is a document that can carry script, and it would be served
 * from the API's own origin.
 */
final class BrandingController
{
    private const TYPES = ['image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp'];

    private const MAX_MB = 2;

    /** multipart: file. */
    public static function uploadLogo(): void
    {
        $admin = Auth::requireAdmin('settings');
        if (!Settings::storageReady()) {
            Response::error(503, 'settings_storage_missing', 'جدول تنظیمات هنوز در دیتابیس ساخته نشده است.');
            return;
        }

        $file = $_FILES['file'] ?? null;
        if ($file === null) {
            Response::error(400, 'missing_file', 'فایلی فرستاده نشد.');
            return;
        }
        if (in_array($file['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
            Response::error(413, 'file_too_large', 'این فایل از سقف آپلود سرور بزرگ‌تر است.');
            return;
        }
        if ($file['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) {
            Response::error(400, 'upload_failed', 'فایل درست آپلود نشد.');
            return;
        }
        if ($file['size'] > self::MAX_MB * 1024 * 1024) {
            Response::error(413, 'file_too_large', 'حجم لوگو باید حداکثر ' . self::MAX_MB . ' مگابایت باشد.');
            return;
        }
        if (!class_exists('finfo')) {
            Response::error(500, 'finfo_missing', 'The server cannot inspect uploads.');
            return;
        }
        $mime = strtolower((string) (new \finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']));
        $ext = self::TYPES[$mime] ?? null;
        if ($ext === null) {
            Response::error(415, 'unsupported_type', 'لوگو باید PNG، JPG یا WebP باشد.');
            return;
        }

        $config = require __DIR__ . '/../../config.php';
        $dir = $config['uploads']['dir'] . '/branding';
        if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
            Response::error(500, 'storage_unwritable', 'The uploads folder is not writable.');
            return;
        }
        $filename = 'logo-' . Uuid::v4() . '.' . $ext;
        if (!move_uploaded_file($file['tmp_name'], $dir . '/' . $filename)) {
            Response::error(500, 'storage_unwritable', 'The uploads folder is not writable.');
            return;
        }

        $url = UploadController::baseUrl() . $config['uploads']['public_url'] . '/branding/' . $filename;
        Response::ok(['value' => self::store($url, $admin['id'])], 201);
    }

    /** Back to the Gymlic mark. */
    public static function removeLogo(): void
    {
        $admin = Auth::requireAdmin('settings');
        Response::ok(['value' => self::store('', $admin['id'])]);
    }

    private static function store(string $url, string $adminId): array
    {
        $branding = Settings::get('branding');
        $previous = $branding['logo_url'];
        $branding['logo_url'] = $url;
        try {
            $saved = Settings::save('branding', $branding, $adminId);
        } catch (Throwable $e) {
            error_log('branding logo: ' . $e->getMessage());
            Response::error(503, 'settings_storage_missing', 'جدول تنظیمات هنوز در دیتابیس ساخته نشده است.');
            exit;
        }
        if ($previous !== $url) {
            self::removeOwnFile($previous);
        }
        AdminController::logActivity(Database::connection(), null, $adminId, null, 'settings_updated', [
            'key'  => 'branding',
            'logo' => $url === '' ? 'removed' : 'uploaded',
        ]);
        return $saved;
    }

    /** Deletes a replaced logo, but only one this controller put in uploads/branding. */
    private static function removeOwnFile(string $url): void
    {
        if (!preg_match('#/branding/(logo-[0-9a-f-]{36}\.(?:png|jpg|webp))$#', $url, $m)) {
            return;
        }
        $config = require __DIR__ . '/../../config.php';
        $path = $config['uploads']['dir'] . '/branding/' . $m[1];
        if (is_file($path)) {
            @unlink($path);
        }
    }
}
