<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\AdminAccess;
use Gymlic\Auth;
use Gymlic\CronHeartbeat;
use Gymlic\Database;
use Gymlic\Receipts;
use Gymlic\Response;
use Gymlic\Settings;

/**
 * Reading and deleting the receipts attached to subscription payment
 * requests. The files are not reachable by URL (see Receipts), so every
 * read goes through here: the club that filed the request, or an admin who
 * reviews payments, nobody else.
 */
final class ReceiptController
{
    /** GET /payment-requests/{id}/receipt: the file itself. */
    public static function show(array $params): void
    {
        $user = Auth::requireUser();
        if (!Receipts::ready()) {
            Response::error(404, 'not_found', 'Receipt not found.');
            return;
        }

        $stmt = Database::connection()->prepare(
            'SELECT pr.receipt_path, c.owner_id FROM payment_requests pr
             JOIN clubs c ON c.id = pr.club_id WHERE pr.id = :id'
        );
        $stmt->execute(['id' => $params['id']]);
        $row = $stmt->fetch();

        $allowed = $row !== false && ($row['owner_id'] === $user['id'] || AdminAccess::can($user, 'finance'));
        $path = $allowed ? Receipts::path($row['receipt_path']) : null;
        if ($path === null || !is_file($path)) {
            // The same answer for "not yours", "no receipt" and "already deleted".
            Response::error(404, 'not_found', 'رسید پیدا نشد. ممکن است پس از بررسی، حذف شده باشد.');
            return;
        }

        header('Content-Type: ' . (str_ends_with($path, '.pdf') ? 'application/pdf' : 'image/jpeg'));
        header('Content-Length: ' . filesize($path));
        header('Content-Disposition: inline; filename="receipt' . (str_ends_with($path, '.pdf') ? '.pdf' : '.jpg') . '"');
        header('Cache-Control: private, no-store');
        header('X-Content-Type-Options: nosniff');
        readfile($path);
    }

    /** DELETE /admin/payment-requests/{id}/receipt: remove one file now. */
    public static function remove(array $params): void
    {
        Auth::requireAdmin('finance');
        if (!Receipts::ready()) {
            Response::error(409, 'receipts_unavailable', 'به‌روزرسانی دیتابیس برای رسیدها هنوز اجرا نشده است.');
            return;
        }

        $pdo = Database::connection();
        $stmt = $pdo->prepare('SELECT receipt_path FROM payment_requests WHERE id = :id');
        $stmt->execute(['id' => $params['id']]);
        $row = $stmt->fetch();
        if ($row === false || $row['receipt_path'] === null) {
            Response::error(404, 'not_found', 'این درخواست رسیدی ندارد.');
            return;
        }

        $freed = Receipts::remove($row['receipt_path']);
        $pdo->prepare('UPDATE payment_requests SET receipt_path = NULL, receipt_purged_at = NOW() WHERE id = :id')
            ->execute(['id' => $params['id']]);

        Response::ok(['ok' => true, 'freed_bytes' => $freed]);
    }

    /** GET /admin/receipts/stats: what is stored and the current rules. */
    public static function stats(): void
    {
        Auth::requireAdmin('finance');

        Response::ok(['ready' => Receipts::ready()] + Receipts::stats());
    }

    /** POST /admin/receipts/purge: run the cleanup now instead of waiting for the cron. */
    public static function purge(): void
    {
        Auth::requireAdmin('finance');
        if (!Receipts::ready()) {
            Response::error(409, 'receipts_unavailable', 'به‌روزرسانی دیتابیس برای رسیدها هنوز اجرا نشده است.');
            return;
        }

        $result = Receipts::purgeExpired(Database::connection());
        CronHeartbeat::record('receipt-cleanup', Receipts::summary($result));

        Response::ok($result + [
            'retention_days' => Settings::get('billing')['receipt_retention_days'],
        ]);
    }
}
