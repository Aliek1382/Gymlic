<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Acl;
use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Settings;
use Gymlic\Uuid;

/**
 * Replaces the Supabase `avatars` storage bucket with the host's filesystem,
 * keeping the folder-per-user layout so the "you may only write your own
 * folder" rule stays a plain path check. Images are re-encoded server-side:
 * the old client-side canvas compression can't be trusted once uploads hit a
 * real server.
 */
final class UploadController
{
    private const MAX_DIMENSION = 512;

    // Chat attachments are stored byte-for-byte, so what keeps the host safe is
    // this whitelist: the extension is derived from the sniffed content, never
    // from the client's filename, and nothing executable or scriptable is in it.
    // extension => [message type, accepted finfo mime types]
    private const MEDIA_TYPES = [
        'mp3'  => ['voice', ['audio/mpeg', 'audio/mp3']],
        'ogg'  => ['voice', ['audio/ogg', 'application/ogg', 'audio/opus', 'video/ogg']],
        'wav'  => ['voice', ['audio/wav', 'audio/x-wav', 'audio/vnd.wave', 'audio/wave']],
        'm4a'  => ['voice', ['audio/mp4', 'audio/x-m4a', 'audio/m4a']],
        // Browsers record voice as webm (Chrome/Firefox) or mp4 (Safari), and
        // finfo often reports those as video/*; see $hint in messageMedia().
        'webm' => [null, ['audio/webm', 'video/webm']],
        'mp4'  => ['video', ['video/mp4']],
        'mov'  => ['video', ['video/quicktime']],
        'jpg'  => ['image', ['image/jpeg']],
        'png'  => ['image', ['image/png']],
        'webp' => ['image', ['image/webp']],
        'pdf'  => ['file', ['application/pdf']],
        'doc'  => ['file', ['application/msword', 'application/vnd.ms-office', 'application/CDFV2']],
        'docx' => ['file', [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/zip',
        ]],
    ];


    public static function avatar(): void
    {
        $user = Auth::requireUser();
        $url = self::storeImage($user['id'], 'avatar.jpg');

        Database::connection()
            ->prepare('UPDATE profiles SET avatar_url = :url WHERE id = :id')
            ->execute(['url' => $url, 'id' => $user['id']]);

        Response::ok(['url' => $url]);
    }

    public static function clubLogo(array $params): void
    {
        $user = Auth::requireUser();
        $clubId = $params['id'];

        $stmt = Database::connection()->prepare('SELECT owner_id FROM clubs WHERE id = :id');
        $stmt->execute(['id' => $clubId]);
        $club = $stmt->fetch();

        if ($club === false) {
            Response::error(404, 'not_found', 'Club not found.');
            return;
        }
        Acl::require($club['owner_id'] === $user['id'], 'Only the club owner can change the logo.');

        $url = self::storeImage($user['id'], 'club-' . $clubId . '.jpg');

        Database::connection()
            ->prepare('UPDATE clubs SET logo_url = :url WHERE id = :id')
            ->execute(['url' => $url, 'id' => $clubId]);

        Response::ok(['url' => $url]);
    }

    /**
     * Stores one chat attachment as-is and returns {url, type, name}. Unlike
     * storeImage nothing is re-encoded (GD only understands images), so the
     * checks below are the whole defence.
     */
    public static function messageMedia(): void
    {
        $user = Auth::requireUser();
        $config = require __DIR__ . '/../../config.php';

        if (!isset($_FILES['file'])) {
            Response::error(400, 'missing_file', 'Send the attachment as multipart form field "file".');
            return;
        }
        $file = $_FILES['file'];
        if (in_array($file['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
            Response::error(413, 'file_too_large', 'That file is larger than the server accepts.');
            return;
        }
        if ($file['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) {
            Response::error(400, 'upload_failed', 'The file did not upload correctly.');
            return;
        }

        [$ext, $type] = self::detectMedia($file['tmp_name'], (string) $file['name'], (string) ($_POST['kind'] ?? ''));
        if ($ext === null) {
            Response::error(415, 'unsupported_type', 'That file type is not allowed.');
            return;
        }
        // Per-type ceilings, set by the admin in /admin/settings (defaults
        // 8MB, video 50MB). Shared-host disk is finite, so these are
        // deliberately tighter than "as big as PHP allows".
        $limits = Settings::get('limits');
        if (!$limits['attachments'][$type]) {
            MessageController::attachmentOff($type);
            return;
        }
        $mb = $limits['upload_mb'][$type];
        if ($file['size'] > $mb * 1024 * 1024) {
            Response::error(413, 'file_too_large', "حجم این نوع فایل باید حداکثر {$mb} مگابایت باشد.");
            return;
        }

        $dir = $config['uploads']['dir'] . '/' . $user['id'];
        if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
            Response::error(500, 'storage_unwritable', 'The uploads folder is not writable.');
            return;
        }

        $filename = Uuid::v4() . '.' . $ext;
        if (!move_uploaded_file($file['tmp_name'], $dir . '/' . $filename)) {
            Response::error(500, 'storage_unwritable', 'The uploads folder is not writable.');
            return;
        }

        $name = trim((string) preg_replace('/[\x00-\x1F\x7F]+/u', '', basename((string) $file['name'])));
        Response::ok([
            'url'  => self::baseUrl() . $config['uploads']['public_url'] . '/' . $user['id'] . '/' . $filename,
            'type' => $type,
            'name' => mb_substr($name, 0, 255),
        ], 201);
    }

    /**
     * @return array{0: ?string, 1: ?string} [extension, message type], or
     *         [null, null] when the content is not on the whitelist.
     */
    private static function detectMedia(string $path, string $clientName, string $kindHint): array
    {
        if (!class_exists('finfo')) {
            Response::error(500, 'finfo_missing', 'The server cannot inspect uploads.');
            exit;
        }
        $mime = (string) (new \finfo(FILEINFO_MIME_TYPE))->file($path);
        $mime = strtolower($mime);
        $clientExt = strtolower(pathinfo($clientName, PATHINFO_EXTENSION));

        $candidates = [];
        foreach (self::MEDIA_TYPES as $ext => [$type, $mimes]) {
            if (in_array($mime, array_map('strtolower', $mimes), true)) {
                $candidates[] = $ext;
            }
        }
        // finfo reports audio-only mp4 as video/mp4 and audio-only webm as
        // video/webm, so a container can match more than one extension. The
        // client's name only ever picks among sniffed candidates.
        if ($mime === 'video/mp4' && $kindHint === 'voice') {
            $candidates = ['m4a'];
        }
        if ($candidates === []) {
            return [null, null];
        }
        $ext = in_array($clientExt, $candidates, true) ? $clientExt : $candidates[0];

        // application/zip is only acceptable as a Word document.
        if ($ext === 'docx' && !self::isDocx($path)) {
            return [null, null];
        }
        // The legacy office/CDF mimes cover xls/ppt too; require the .doc name.
        if ($ext === 'doc' && $clientExt !== 'doc') {
            return [null, null];
        }

        $type = self::MEDIA_TYPES[$ext][0];
        if ($type === null) { // webm: voice only when the recorder said so
            $type = $kindHint === 'voice' ? 'voice' : 'video';
        }

        return [$ext, $type];
    }

    private static function isDocx(string $path): bool
    {
        if (!class_exists('ZipArchive')) {
            return false;
        }
        $zip = new \ZipArchive();
        if ($zip->open($path) !== true) {
            return false;
        }
        $ok = $zip->locateName('word/document.xml') !== false;
        $zip->close();

        return $ok;
    }

    /**
     * True when $url is a file this user uploaded through messageMedia(), of
     * the type being claimed — so a message can't point at somebody else's
     * upload or at an arbitrary address.
     */
    public static function ownsMessageMedia(string $url, string $ownerId, string $type): bool
    {
        $config = require __DIR__ . '/../../config.php';
        $path = parse_url($url, PHP_URL_PATH);
        $prefix = $config['uploads']['public_url'] . '/' . $ownerId . '/';
        if (!is_string($path) || !str_starts_with($path, $prefix)) {
            return false;
        }
        $filename = substr($path, strlen($prefix));
        if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.([a-z0-9]+)$/', $filename, $m)
            || !isset(self::MEDIA_TYPES[$m[1]])) {
            return false;
        }
        $storedType = self::MEDIA_TYPES[$m[1]][0];
        $typeOk = $storedType === null ? in_array($type, ['voice', 'video'], true) : $storedType === $type;

        return $typeOk && is_file($config['uploads']['dir'] . '/' . $ownerId . '/' . $filename);
    }

    /** Validates, re-encodes and writes the uploaded image; returns its public URL. */
    public static function storeImage(string $ownerId, string $filename): string
    {
        $config = require __DIR__ . '/../../config.php';

        if (!isset($_FILES['file'])) {
            Response::error(400, 'missing_file', 'Send the image as multipart form field "file".');
            exit;
        }

        $file = $_FILES['file'];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            Response::error(400, 'upload_failed', 'The file did not upload correctly.');
            exit;
        }
        if ($file['size'] > $config['uploads']['max_bytes']) {
            Response::error(400, 'file_too_large', 'Images must be 8MB or smaller.');
            exit;
        }

        $raw = file_get_contents($file['tmp_name']);
        $image = $raw === false ? false : @imagecreatefromstring($raw);
        if ($image === false) {
            Response::error(400, 'invalid_image', 'That file is not a readable image.');
            exit;
        }

        // JPEG has no transparency: a transparent PNG (a logo, usually)
        // would turn black, so it is laid on white first.
        $flat = imagecreatetruecolor(imagesx($image), imagesy($image));
        imagefill($flat, 0, 0, (int) imagecolorallocate($flat, 255, 255, 255));
        imagecopy($flat, $image, 0, 0, 0, 0, imagesx($image), imagesy($image));
        imagedestroy($image);
        $image = $flat;

        $resized = imagescale($image, ...self::fitWithin(imagesx($image), imagesy($image)));
        imagedestroy($image);
        if ($resized === false) {
            Response::error(500, 'resize_failed', 'Could not process the image.');
            exit;
        }

        $dir = $config['uploads']['dir'] . '/' . $ownerId;
        if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
            Response::error(500, 'storage_unwritable', 'The uploads folder is not writable.');
            exit;
        }

        $written = imagejpeg($resized, $dir . '/' . $filename, 90);
        imagedestroy($resized);
        if (!$written) {
            Response::error(500, 'storage_unwritable', 'The uploads folder is not writable.');
            exit;
        }

        // Cache-bust so <img> refetches instead of showing the previous file,
        // which lives at this same path.
        return self::baseUrl() . $config['uploads']['public_url'] . '/' . $ownerId . '/' . $filename
            . '?t=' . time();
    }

    /** @return array{0: int, 1: int} width/height scaled to fit MAX_DIMENSION, never upscaled. */
    private static function fitWithin(int $width, int $height): array
    {
        $longest = max($width, $height);
        if ($longest <= self::MAX_DIMENSION) {
            return [$width, $height];
        }
        $ratio = self::MAX_DIMENSION / $longest;
        return [(int) round($width * $ratio), (int) round($height * $ratio)];
    }

    public static function baseUrl(): string
    {
        $https = ($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off';
        $scheme = $https || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https' ? 'https' : 'http';
        return $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
    }
}
