<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Uuid;
use Gymlic\Validate;

/**
 * The how-to image (or GIF) and video of a library exercise, set from
 * /admin/library. Each is an uploaded file or a link (an Aparat or YouTube
 * page for the video); trainers and athletes see them wherever the exercise
 * shows. Needs the content permission.
 */
final class AdminExerciseMediaController
{
    /** Stored byte-for-byte (a GIF must keep its animation), so this list is the whole defence. */
    private const TYPES = [
        'image' => ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'],
        'video' => ['video/mp4' => 'mp4', 'video/webm' => 'webm'],
    ];
    private const MAX_MB = ['image' => 8, 'video' => 60];
    private const COLUMN = ['image' => 'image_url', 'video' => 'video_url'];

    public static function ready(): bool
    {
        return Database::hasColumn('exercises', 'video_url');
    }

    /** multipart: file, slot=image|video. */
    public static function upload(array $params): void
    {
        $admin = Auth::requireAdmin('content');
        $exercise = self::exerciseOr404($params['id']);
        $slot = (string) ($_POST['slot'] ?? '');
        if (!isset(self::TYPES[$slot])) {
            Response::error(400, 'invalid_slot', 'slot must be image or video.');
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
        if ($file['size'] > self::MAX_MB[$slot] * 1024 * 1024) {
            Response::error(413, 'file_too_large', 'حجم ' . ($slot === 'image' ? 'عکس' : 'ویدیو') . ' باید حداکثر ' . self::MAX_MB[$slot] . ' مگابایت باشد.');
            return;
        }
        if (!class_exists('finfo')) {
            Response::error(500, 'finfo_missing', 'The server cannot inspect uploads.');
            return;
        }
        $mime = strtolower((string) (new \finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']));
        $ext = self::TYPES[$slot][$mime] ?? null;
        if ($ext === null) {
            Response::error(415, 'unsupported_type', $slot === 'image'
                ? 'عکس باید JPG، PNG، WebP یا GIF باشد.'
                : 'ویدیو باید MP4 یا WebM باشد. برای فرمت‌های دیگر لینک آپارات بگذارید.');
            return;
        }

        $config = require __DIR__ . '/../../config.php';
        $dir = $config['uploads']['dir'] . '/library';
        if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
            Response::error(500, 'storage_unwritable', 'The uploads folder is not writable.');
            return;
        }
        $filename = 'exercise-' . Uuid::v4() . '.' . $ext;
        if (!move_uploaded_file($file['tmp_name'], $dir . '/' . $filename)) {
            Response::error(500, 'storage_unwritable', 'The uploads folder is not writable.');
            return;
        }

        $url = UploadController::baseUrl() . $config['uploads']['public_url'] . '/library/' . $filename;
        self::store($exercise, $slot, $url, $admin['id']);
        Response::ok([self::COLUMN[$slot] => $url], 201);
    }

    /** {slot, url}: a link instead of a file, or url null to remove it. */
    public static function setLink(array $params): void
    {
        $admin = Auth::requireAdmin('content');
        $exercise = self::exerciseOr404($params['id']);
        $data = Validate::body();
        $slot = (string) ($data['slot'] ?? '');
        if (!isset(self::COLUMN[$slot])) {
            Response::error(400, 'invalid_slot', 'slot must be image or video.');
            return;
        }
        $url = Validate::nullableString(trim((string) ($data['url'] ?? '')));
        if ($url !== null && (mb_strlen($url) > 1024 || !preg_match('#^https://[^\s<>"]+$#i', $url))) {
            Response::error(400, 'invalid_url', 'لینک باید کامل و با https:// شروع شود.');
            return;
        }
        self::store($exercise, $slot, $url, $admin['id']);
        Response::ok([self::COLUMN[$slot] => $url]);
    }

    private static function store(array $exercise, string $slot, ?string $url, string $adminId): void
    {
        $column = self::COLUMN[$slot];
        $pdo = Database::connection();
        $pdo->prepare("UPDATE exercises SET {$column} = :url WHERE id = :id")->execute(['url' => $url, 'id' => $exercise['id']]);
        if ($exercise[$column] !== $url) {
            self::removeOwnFile($exercise[$column]);
        }
        AdminController::logActivity($pdo, null, $adminId, null, 'exercise_media_changed', [
            'name' => $exercise['name'],
            'slot' => $slot,
            'removed' => $url === null,
        ]);
    }

    /** Deletes a replaced file, but only one this controller put in uploads/library. */
    private static function removeOwnFile(?string $url): void
    {
        if ($url === null || !preg_match('#/library/(exercise-[0-9a-f-]{36}\.(?:jpg|png|webp|gif|mp4|webm))$#', $url, $m)) {
            return;
        }
        $config = require __DIR__ . '/../../config.php';
        $path = $config['uploads']['dir'] . '/library/' . $m[1];
        if (is_file($path)) {
            @unlink($path);
        }
    }

    private static function exerciseOr404(string $id): array
    {
        if (!self::ready()) {
            Response::error(503, 'media_not_ready', 'عکس و ویدیوی حرکات هنوز فعال نیست. به‌روزرسانی «محتوای آماده برای مربی‌ها و عکس و ویدیوی حرکات (فاز ۸)» را از صفحهٔ «به‌روزرسانی دیتابیس» اجرا کنید.');
            exit;
        }
        $stmt = Database::connection()->prepare('SELECT id, name, image_url, video_url FROM exercises WHERE id = :id');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        if ($row === false) {
            Response::error(404, 'not_found', 'حرکت پیدا نشد.');
            exit;
        }
        return $row;
    }
}
