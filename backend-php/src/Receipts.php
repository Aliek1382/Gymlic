<?php
declare(strict_types=1);

namespace Gymlic;

use PDO;
use Throwable;

/**
 * The proof of payment a club attaches to a subscription payment request: a
 * photo or PDF of the bank receipt, kept only as long as it is useful.
 *
 * - Files live in uploads/receipts/, which is closed to direct web access
 *   (see ensureDir) and served through the API to the club that filed the
 *   request and to admins with the finance permission.
 * - Images are re-encoded to a smaller JPEG here, whatever the browser sent;
 *   PDFs are kept as they are, within the size ceiling from the admin's
 *   billing settings.
 * - A file is deleted a few days after its request has been reviewed (the
 *   admin sets how many), by cron/receipt-cleanup.php, and also on demand
 *   from the admin panel. Waiting requests keep theirs.
 *
 * The same files, rules and cleanup serve the claims an athlete files against a
 * trainer's invoice (invoice_payment_claims); see InvoiceClaimController.
 *
 * Like Discounts, it only runs once its columns exist: the backend can reach
 * the host before payment-receipts-update.sql has been run.
 */
final class Receipts
{
    private const MAX_DIMENSION = 1400;
    private const JPEG_QUALITY = 75;
    private const NAME_PATTERN = '/^[0-9a-f]{32}\.(jpg|pdf)$/';

    /** Tables whose rows point at a receipt file (receipt_path, status, reviewed_at / receipt_purged_at). */
    private const SOURCES = ['payment_requests', 'invoice_payment_claims'];

    private function __construct()
    {
    }

    /** False until payment-receipts-update.sql has been run on this database. */
    public static function ready(): bool
    {
        return Database::hasColumn('payment_requests', 'tracking_code')
            && Database::hasColumn('payment_requests', 'card_last4')
            && Database::hasColumn('payment_requests', 'receipt_path');
    }

    /** False until invoice-claims-update.sql has been run on this database. */
    public static function claimsReady(): bool
    {
        return Database::hasColumn('invoice_payment_claims', 'receipt_path')
            && Database::hasTable('trainer_payment_info');
    }

    /**
     * The tracking code, last four card digits and optional payment time from
     * a request, cleaned up (Persian digits become Latin).
     *
     * @return array{row: array<string, mixed>}|array{error: array{0: string, 1: string}}
     */
    public static function parseFields(array $data): array
    {
        $digits = static fn (mixed $v): string => strtr(trim((string) $v), [
            '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
            '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
            '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
            '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
        ]);

        $tracking = preg_replace('/\\s+/', '', $digits($data['tracking_code'] ?? '')) ?? '';
        if (preg_match('/^[A-Za-z0-9_\\/-]{4,40}$/', $tracking) !== 1) {
            return ['error' => ['invalid_tracking_code', 'کد پیگیری باید بین ۴ تا ۴۰ حرف یا رقم باشد.']];
        }
        $last4 = $digits($data['card_last4'] ?? '');
        if (preg_match('/^[0-9]{4}$/', $last4) !== 1) {
            return ['error' => ['invalid_card_last4', 'چهار رقم آخر کارت پرداخت‌کننده را وارد کنید.']];
        }

        $paidAt = null;
        $rawPaidAt = trim($digits($data['paid_at'] ?? ''));
        if ($rawPaidAt !== '') {
            $time = strtotime($rawPaidAt);
            if ($time === false || $time > time() + 86400) {
                return ['error' => ['invalid_paid_at', 'زمان واریز معتبر نیست.']];
            }
            $paidAt = date('Y-m-d H:i:s', $time);
        }

        return ['row' => ['tracking_code' => $tracking, 'card_last4' => $last4, 'paid_at' => $paidAt]];
    }

    /**
     * Validates the uploaded "receipt" field and stores it, returning the
     * stored file name. The error is ready for Response::error.
     *
     * @return array{ok: true, file: string}|array{ok: false, status: int, code: string, message: string}
     */
    public static function store(array $upload, int $maxMb): array
    {
        if (in_array($upload['error'] ?? UPLOAD_ERR_NO_FILE, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
            return self::fail(413, 'receipt_too_large', 'حجم رسید بیشتر از حد مجاز سرور است.');
        }
        if (($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file((string) $upload['tmp_name'])) {
            return self::fail(400, 'receipt_upload_failed', 'آپلود رسید کامل نشد. دوباره تلاش کنید.');
        }
        if ((int) $upload['size'] > $maxMb * 1024 * 1024) {
            return self::fail(413, 'receipt_too_large', "حجم رسید باید حداکثر {$maxMb} مگابایت باشد.");
        }
        if (!class_exists('finfo')) {
            return self::fail(500, 'finfo_missing', 'The server cannot inspect uploads.');
        }

        $tmp = (string) $upload['tmp_name'];
        $mime = strtolower((string) (new \finfo(FILEINFO_MIME_TYPE))->file($tmp));

        if ($mime === 'application/pdf') {
            $head = (string) file_get_contents($tmp, false, null, 0, 5);
            if ($head !== '%PDF-') {
                return self::fail(415, 'unsupported_receipt', 'فقط تصویر یا فایل PDF قابل قبول است.');
            }
            $extension = 'pdf';
        } elseif (in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
            $extension = 'jpg';
        } else {
            return self::fail(415, 'unsupported_receipt', 'فقط تصویر (JPG، PNG، WebP) یا فایل PDF قابل قبول است.');
        }

        $dir = self::ensureDir();
        if ($dir === null) {
            return self::fail(500, 'storage_unwritable', 'The uploads folder is not writable.');
        }
        $file = bin2hex(random_bytes(16)) . '.' . $extension;
        $target = $dir . '/' . $file;

        if ($extension === 'pdf') {
            $written = move_uploaded_file($tmp, $target);
        } else {
            $written = self::writeJpeg($tmp, $mime, $target);
            if ($written === null) {
                return self::fail(400, 'invalid_receipt', 'تصویر رسید خوانده نشد. تصویر دیگری را امتحان کنید.');
            }
        }
        if (!$written) {
            return self::fail(500, 'storage_unwritable', 'The uploads folder is not writable.');
        }

        return ['ok' => true, 'file' => $file];
    }

    /** Absolute path of a stored receipt, or null when the name is not one we wrote. */
    public static function path(?string $file): ?string
    {
        if ($file === null || preg_match(self::NAME_PATTERN, $file) !== 1) {
            return null;
        }
        return self::baseDir() . '/' . $file;
    }

    /** Deletes the file (if there) and returns the bytes it freed. */
    public static function remove(?string $file): int
    {
        $path = self::path($file);
        if ($path === null || !is_file($path)) {
            return 0;
        }
        $size = (int) filesize($path);
        return @unlink($path) ? $size : 0;
    }

    /**
     * Deletes the receipts of requests and claims reviewed more than the
     * configured number of days ago, and any file nothing points to any more
     * (a failed submit, a deleted club). Returns what it removed.
     *
     * @return array{deleted: int, freed_bytes: int}
     */
    public static function purgeExpired(PDO $pdo): array
    {
        $deleted = 0;
        $freed = 0;
        $sources = array_values(array_filter(self::SOURCES, static fn (string $t): bool => Database::hasColumn($t, 'receipt_path')));

        $days = Settings::get('billing')['receipt_retention_days'];
        if ($days > 0) {
            foreach ($sources as $table) {
                $stmt = $pdo->prepare(
                    "SELECT id, receipt_path FROM {$table}
                     WHERE receipt_path IS NOT NULL AND status <> 'pending'
                       AND reviewed_at IS NOT NULL AND reviewed_at < :cutoff"
                );
                $stmt->execute(['cutoff' => date('Y-m-d H:i:s', time() - $days * 86400)]);
                foreach ($stmt->fetchAll() as $row) {
                    $freed += self::remove($row['receipt_path']);
                    $deleted++;
                    $pdo->prepare("UPDATE {$table} SET receipt_path = NULL, receipt_purged_at = NOW() WHERE id = :id")
                        ->execute(['id' => $row['id']]);
                }
            }
        }

        $referenced = [];
        foreach ($sources as $table) {
            foreach ($pdo->query("SELECT receipt_path FROM {$table} WHERE receipt_path IS NOT NULL")->fetchAll(PDO::FETCH_COLUMN) as $file) {
                $referenced[$file] = true;
            }
        }
        foreach (self::files() as $file => $path) {
            // A day's grace: a file may have been written a moment before its row.
            if (!isset($referenced[$file]) && filemtime($path) < time() - 86400) {
                $freed += self::remove($file);
                $deleted++;
            }
        }

        return ['deleted' => $deleted, 'freed_bytes' => $freed];
    }

    /**
     * purgeExpired at most once every few hours, for the requests that reach
     * the host before (or without) its cron job. Never throws.
     */
    public static function purgeIfDue(PDO $pdo): void
    {
        try {
            $stmt = $pdo->prepare('SELECT value FROM app_settings WHERE setting_key = :key');
            $stmt->execute(['key' => 'cron.receipt-cleanup']);
            $last = json_decode((string) $stmt->fetchColumn(), true);
            if (is_array($last) && isset($last['at']) && strtotime((string) $last['at']) > time() - 6 * 3600) {
                return;
            }
            $result = self::purgeExpired($pdo);
            CronHeartbeat::record('receipt-cleanup', self::summary($result));
        } catch (Throwable $e) {
            error_log('receipt cleanup: ' . $e->getMessage());
        }
    }

    /** @param array{deleted: int, freed_bytes: int} $result */
    public static function summary(array $result): string
    {
        return "receipts deleted: {$result['deleted']}, freed: " . round($result['freed_bytes'] / 1024) . ' KB';
    }

    /** What is stored right now. @return array{count: int, bytes: int} */
    public static function stats(): array
    {
        $count = 0;
        $bytes = 0;
        foreach (self::files() as $path) {
            $count++;
            $bytes += (int) filesize($path);
        }
        return ['count' => $count, 'bytes' => $bytes];
    }

    private static function baseDir(): string
    {
        $config = require __DIR__ . '/../config.php';
        return $config['uploads']['dir'] . '/receipts';
    }

    /** The receipts folder, created on first use with direct web access denied. */
    private static function ensureDir(): ?string
    {
        $dir = self::baseDir();
        if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) {
            return null;
        }
        $guard = $dir . '/.htaccess';
        if (!is_file($guard)) {
            // Bank receipts are not public: the parent .htaccess serves
            // everything under /uploads/ directly, and this overrides it.
            @file_put_contents($guard, "Require all denied\n<IfModule !mod_authz_core.c>\n  Deny from all\n</IfModule>\n");
        }
        return is_writable($dir) ? $dir : null;
    }

    /** @return array<string, string> file name => absolute path */
    private static function files(): array
    {
        $out = [];
        foreach (glob(self::baseDir() . '/*') ?: [] as $path) {
            if (is_file($path) && preg_match(self::NAME_PATTERN, basename($path)) === 1) {
                $out[basename($path)] = $path;
            }
        }
        return $out;
    }

    /** Re-encodes the image as a smaller JPEG at $target; null when it is not a readable image. */
    private static function writeJpeg(string $tmp, string $mime, string $target): ?bool
    {
        $raw = file_get_contents($tmp);
        $image = $raw === false ? false : @imagecreatefromstring($raw);
        if ($image === false) {
            return null;
        }

        // Phones store the rotation in EXIF rather than in the pixels.
        if ($mime === 'image/jpeg' && function_exists('exif_read_data')) {
            $orientation = (int) (@exif_read_data($tmp)['Orientation'] ?? 1);
            $angle = [3 => 180, 6 => -90, 8 => 90][$orientation] ?? 0;
            if ($angle !== 0) {
                $rotated = imagerotate($image, $angle, 0);
                if ($rotated !== false) {
                    imagedestroy($image);
                    $image = $rotated;
                }
            }
        }

        $width = imagesx($image);
        $height = imagesy($image);
        $ratio = min(1, self::MAX_DIMENSION / max($width, $height));
        $newWidth = max(1, (int) round($width * $ratio));
        $newHeight = max(1, (int) round($height * $ratio));

        // JPEG has no alpha: flatten a transparent PNG on white, not black.
        $canvas = imagecreatetruecolor($newWidth, $newHeight);
        imagefill($canvas, 0, 0, (int) imagecolorallocate($canvas, 255, 255, 255));
        imagecopyresampled($canvas, $image, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
        imagedestroy($image);

        $written = imagejpeg($canvas, $target, self::JPEG_QUALITY);
        imagedestroy($canvas);

        return $written;
    }

    /** @return array{ok: false, status: int, code: string, message: string} */
    private static function fail(int $status, string $code, string $message): array
    {
        return ['ok' => false, 'status' => $status, 'code' => $code, 'message' => $message];
    }
}
