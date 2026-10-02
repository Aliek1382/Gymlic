<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Validate;
use PDO;

/**
 * The trainer's own logo and watermark on a printed or PDF plan, on every
 * plan. Stored on trainer_profiles (trainer-print-branding-update.sql);
 * until that SQL has run, reads say ready = false and the print falls back
 * to the profile photo and «جیم‌لیک — name». The athlete's print reads the
 * trainer's from /auth/me (of()).
 */
final class PrintBrandingController
{
    private const WATERMARK_MAX = 60;

    public static function ready(): bool
    {
        return Database::hasColumn('trainer_profiles', 'print_logo_url')
            && Database::hasColumn('trainer_profiles', 'print_watermark');
    }

    /** @return array{logo_url: ?string, watermark: ?string}|null null before the SQL has run */
    public static function of(PDO $pdo, string $trainerId): ?array
    {
        if (!self::ready()) {
            return null;
        }
        $stmt = $pdo->prepare('SELECT print_logo_url, print_watermark FROM trainer_profiles WHERE trainer_id = :t');
        $stmt->execute(['t' => $trainerId]);
        $row = $stmt->fetch();
        return ['logo_url' => $row['print_logo_url'] ?? null, 'watermark' => $row['print_watermark'] ?? null];
    }

    public static function get(): void
    {
        $user = self::trainer();
        $branding = self::of(Database::connection(), $user['id']);
        Response::ok(['ready' => $branding !== null] + ($branding ?? ['logo_url' => null, 'watermark' => null]));
    }

    /** body: watermark (empty or null = the default «جیم‌لیک — name»). */
    public static function update(): void
    {
        $user = self::trainer();
        self::requireReady();
        $value = Validate::nullableString(Validate::body()['watermark'] ?? null);
        $value = $value === null ? null : trim((string) preg_replace('/\s+/u', ' ', $value));
        if ($value !== null && mb_strlen($value) > self::WATERMARK_MAX) {
            Response::error(400, 'watermark_too_long', 'متن واترمارک حداکثر ' . self::WATERMARK_MAX . ' نویسه است.');
            return;
        }
        self::save($user['id'], 'print_watermark', $value === '' ? null : $value);
        self::get();
    }

    /** multipart: file. Re-encoded like an avatar (UploadController::storeImage). */
    public static function uploadLogo(): void
    {
        $user = self::trainer();
        self::requireReady();
        $url = UploadController::storeImage($user['id'], 'print-logo.jpg');
        self::save($user['id'], 'print_logo_url', $url);
        self::get();
    }

    public static function removeLogo(): void
    {
        $user = self::trainer();
        self::requireReady();
        self::save($user['id'], 'print_logo_url', null);
        self::get();
    }

    /** @return array<string, mixed> */
    private static function trainer(): array
    {
        $user = Auth::requireUser();
        if ($user['account_type'] !== 'trainer') {
            Response::error(403, 'forbidden', 'فقط مربی سربرگ چاپ دارد.');
            exit;
        }
        return $user;
    }

    private static function requireReady(): void
    {
        if (!self::ready()) {
            Response::error(503, 'update_required', 'به‌روزرسانی دیتابیس «لوگو و واترمارک مربی» هنوز اجرا نشده است.');
            exit;
        }
    }

    /** One column on the trainer's row, made if the trainer has no résumé yet. */
    private static function save(string $trainerId, string $column, ?string $value): void
    {
        Database::connection()->prepare(
            "INSERT INTO trainer_profiles (trainer_id, {$column}) VALUES (:t, :v)
             ON DUPLICATE KEY UPDATE {$column} = VALUES({$column})"
        )->execute(['t' => $trainerId, 'v' => $value]);
    }
}
