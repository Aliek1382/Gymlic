<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Acl;
use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\Response;

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

    /** Validates, re-encodes and writes the uploaded image; returns its public URL. */
    private static function storeImage(string $ownerId, string $filename): string
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

    private static function baseUrl(): string
    {
        $https = ($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off';
        $scheme = $https || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https' ? 'https' : 'http';
        return $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
    }
}
