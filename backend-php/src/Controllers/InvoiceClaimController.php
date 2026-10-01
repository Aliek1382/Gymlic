<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Acl;
use Gymlic\Auth;
use Gymlic\CardInfo;
use Gymlic\Database;
use Gymlic\Receipts;
use Gymlic\Response;
use Gymlic\Settings;
use Gymlic\Templates;
use Gymlic\Uuid;
use Gymlic\Validate;
use PDO;
use Throwable;

/**
 * Card-to-card payment of a trainer's invoice. The trainer publishes the card
 * the money goes to (trainer_payment_info); the athlete pays outside the site
 * and files a claim here (tracking code, last four card digits, receipt); the
 * trainer approves it, which settles the invoice, or rejects it with a reason
 * and the athlete files another. Until a claim is approved the invoice stays
 * pending and its plan stays locked.
 *
 * Needs invoice-claims-update.sql: without it every endpoint answers 409 and
 * the pages hide the feature (see Receipts::claimsReady).
 */
final class InvoiceClaimController
{
    // ---- Trainer: where to send the money -------------------------------

    /** GET /payment-info: the trainer's own receiving card. */
    public static function paymentInfo(): void
    {
        $user = Auth::requireUser();
        $empty = ['card_number' => '', 'sheba' => '', 'holder_name' => '', 'bank_name' => ''];

        if (!Database::hasTable('trainer_payment_info')) {
            Response::ok(['ready' => false, 'info' => $empty]);
            return;
        }
        $stmt = Database::connection()->prepare(
            'SELECT card_number, sheba, holder_name, bank_name FROM trainer_payment_info WHERE trainer_id = :id'
        );
        $stmt->execute(['id' => $user['id']]);
        $row = $stmt->fetch();

        Response::ok(['ready' => true, 'info' => $row === false ? $empty : array_map('strval', $row)]);
    }

    /** PUT /payment-info */
    public static function savePaymentInfo(): void
    {
        $user = Auth::requireUser();
        if (!Database::hasTable('trainer_payment_info')) {
            Response::error(409, 'claims_unavailable', 'به‌روزرسانی دیتابیس برای پرداخت کارت‌به‌کارت هنوز اجرا نشده است.');
            return;
        }
        $data = Validate::body();

        $card = CardInfo::digits($data['card_number'] ?? '');
        if ($card !== '' && !CardInfo::validCard($card)) {
            Response::error(400, 'invalid_card', 'شمارهٔ کارت باید ۱۶ رقم و معتبر باشد.');
            return;
        }
        $sheba = CardInfo::shebaDigits($data['sheba'] ?? '');
        if ($sheba !== '' && strlen($sheba) !== 24) {
            Response::error(400, 'invalid_sheba', 'شمارهٔ شبا باید ۲۴ رقم (بعد از IR) باشد.');
            return;
        }

        Database::connection()->prepare(
            'INSERT INTO trainer_payment_info (trainer_id, card_number, sheba, holder_name, bank_name)
             VALUES (:id, :card, :sheba, :holder, :bank)
             ON DUPLICATE KEY UPDATE card_number = VALUES(card_number), sheba = VALUES(sheba),
                                     holder_name = VALUES(holder_name), bank_name = VALUES(bank_name)'
        )->execute([
            'id'     => $user['id'],
            'card'   => $card !== '' ? $card : null,
            'sheba'  => $sheba !== '' ? 'IR' . $sheba : null,
            'holder' => self::text($data['holder_name'] ?? '', 100),
            'bank'   => self::text($data['bank_name'] ?? '', 60),
        ]);

        Response::ok(['ok' => true]);
    }

    // ---- Athlete: "I paid" -----------------------------------------------

    /** POST /invoices/{id}/claim (multipart with the receipt, or JSON without). */
    public static function submit(array $params): void
    {
        $user = Auth::requireUser();
        if (!self::ready()) {
            return;
        }

        $pdo = Database::connection();
        $stmt = $pdo->prepare('SELECT id, trainer_id, athlete_id, item_type, status FROM invoices WHERE id = :id');
        $stmt->execute(['id' => $params['id']]);
        $invoice = $stmt->fetch();
        if ($invoice === false || $invoice['athlete_id'] !== $user['id']) {
            Response::error(404, 'not_found', 'Invoice not found.');
            return;
        }
        if ($invoice['status'] !== 'pending') {
            Response::error(409, 'not_pending', 'این فاکتور دیگر در انتظار پرداخت نیست.');
            return;
        }

        $waiting = $pdo->prepare("SELECT 1 FROM invoice_payment_claims WHERE invoice_id = :id AND status = 'pending'");
        $waiting->execute(['id' => $invoice['id']]);
        if ($waiting->fetchColumn() !== false) {
            Response::error(409, 'claim_pending', 'پرداخت قبلی شما هنوز در انتظار تأیید مربی است.');
            return;
        }

        $multipart = str_starts_with(strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? '')), 'multipart/form-data');
        $data = $multipart ? $_POST : Validate::body();

        $fields = Receipts::parseFields($data);
        if (isset($fields['error'])) {
            Response::error(400, $fields['error'][0], $fields['error'][1]);
            return;
        }

        $billing = Settings::get('billing');
        $file = null;
        $upload = $_FILES['receipt'] ?? null;
        if ($upload !== null && ($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
            $stored = Receipts::store($upload, $billing['receipt_max_mb']);
            if (!$stored['ok']) {
                Response::error($stored['status'], $stored['code'], $stored['message']);
                return;
            }
            $file = $stored['file'];
        } elseif ($billing['receipt_required']) {
            Response::error(400, 'receipt_required', 'تصویر یا فایل رسید پرداخت را پیوست کنید.');
            return;
        }

        $id = Uuid::v4();
        try {
            $pdo->prepare(
                'INSERT INTO invoice_payment_claims
                   (id, invoice_id, athlete_id, tracking_code, card_last4, paid_at, note, receipt_path)
                 VALUES (:id, :invoice_id, :athlete_id, :tracking_code, :card_last4, :paid_at, :note, :receipt_path)'
            )->execute([
                'id'            => $id,
                'invoice_id'    => $invoice['id'],
                'athlete_id'    => $user['id'],
                'tracking_code' => $fields['row']['tracking_code'],
                'card_last4'    => $fields['row']['card_last4'],
                'paid_at'       => $fields['row']['paid_at'],
                'note'          => self::text($data['note'] ?? '', 500),
                'receipt_path'  => $file,
            ]);
        } catch (Throwable $e) {
            Receipts::remove($file);
            throw $e;
        }

        try {
            Templates::notify(
                $pdo,
                'invoice_claim_submitted',
                $invoice['trainer_id'],
                $user['id'],
                'invoice_paid',
                ['name' => trim($user['first_name'] . ' ' . $user['last_name']) ?: 'ورزشکار', 'title' => InvoiceController::titleOf($invoice['id'])],
                '/invoices',
                ['invoice_id' => $invoice['id']]
            );
        } catch (Throwable $e) {
            error_log('invoice claim notice: ' . $e->getMessage());
        }
        if ($file !== null) {
            Receipts::purgeIfDue($pdo);
        }

        Response::ok(['id' => $id], 201);
    }

    // ---- Trainer: review -------------------------------------------------

    /** POST /invoices/{id}/claim/approve: the money arrived; settles the invoice. */
    public static function approve(array $params): void
    {
        $user = Auth::requireUser();
        if (!self::ready()) {
            return;
        }
        $invoice = self::ownInvoice($params['id'], $user['id']);
        if (self::pendingClaim($invoice['id']) === null) {
            Response::error(409, 'no_claim', 'پرداختی برای تأیید وجود ندارد.');
            return;
        }

        // Settling closes the claim as approved in the same transaction.
        if (!InvoiceController::settle($invoice, 'card_transfer', null, $user['id'])) {
            Response::error(409, 'not_pending', 'Only a pending invoice can be marked paid.');
            return;
        }

        Response::ok(['ok' => true]);
    }

    /** POST /invoices/{id}/claim/reject {note}: the money did not arrive; the athlete may try again. */
    public static function reject(array $params): void
    {
        $user = Auth::requireUser();
        if (!self::ready()) {
            return;
        }
        $invoice = self::ownInvoice($params['id'], $user['id']);
        $claim = self::pendingClaim($invoice['id']);
        if ($claim === null) {
            Response::error(409, 'no_claim', 'پرداختی برای رد کردن وجود ندارد.');
            return;
        }

        $note = self::text(Validate::body()['note'] ?? '', 500);
        $pdo = Database::connection();
        $stmt = $pdo->prepare(
            "UPDATE invoice_payment_claims SET status = 'rejected', trainer_note = :note, reviewed_at = NOW()
             WHERE id = :id AND status = 'pending'"
        );
        $stmt->execute(['note' => $note, 'id' => $claim]);
        if ($stmt->rowCount() === 0) {
            Response::error(409, 'no_claim', 'این پرداخت قبلاً بررسی شده است.');
            return;
        }

        Templates::notify(
            $pdo,
            'invoice_claim_rejected',
            $invoice['athlete_id'],
            $user['id'],
            'invoice_cancelled',
            ['reason' => $note ?? 'برای پیگیری با مربی خود صحبت کنید.'],
            InvoiceController::linkFor($invoice['item_type']),
            ['invoice_id' => $invoice['id']]
        );

        Response::ok(['ok' => true]);
    }

    // ---- Receipt file ----------------------------------------------------

    /** GET /invoice-claims/{id}/receipt: to the athlete who filed it and the trainer it was filed to. */
    public static function receipt(array $params): void
    {
        $user = Auth::requireUser();
        $path = null;

        if (Receipts::claimsReady()) {
            $stmt = Database::connection()->prepare(
                'SELECT c.receipt_path, c.athlete_id, i.trainer_id FROM invoice_payment_claims c
                 JOIN invoices i ON i.id = c.invoice_id WHERE c.id = :id'
            );
            $stmt->execute(['id' => $params['id']]);
            $row = $stmt->fetch();
            if ($row !== false && in_array($user['id'], [$row['athlete_id'], $row['trainer_id']], true)) {
                $path = Receipts::path($row['receipt_path']);
            }
        }
        if ($path === null || !is_file($path)) {
            Response::error(404, 'not_found', 'رسید پیدا نشد. ممکن است پس از بررسی، حذف شده باشد.');
            return;
        }

        $pdf = str_ends_with($path, '.pdf');
        header('Content-Type: ' . ($pdf ? 'application/pdf' : 'image/jpeg'));
        header('Content-Length: ' . filesize($path));
        header('Content-Disposition: inline; filename="receipt' . ($pdf ? '.pdf' : '.jpg') . '"');
        header('Cache-Control: private, no-store');
        header('X-Content-Type-Options: nosniff');
        readfile($path);
    }

    // ---- Helpers ---------------------------------------------------------

    private static function ready(): bool
    {
        if (Receipts::claimsReady()) {
            return true;
        }
        Response::error(409, 'claims_unavailable', 'به‌روزرسانی دیتابیس برای پرداخت کارت‌به‌کارت هنوز اجرا نشده است.');
        return false;
    }

    /** The invoice, if it was issued by $trainerId; otherwise ends the request with 404/403. */
    private static function ownInvoice(string $id, string $trainerId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT id, trainer_id, athlete_id, item_type, item_id, status FROM invoices WHERE id = :id'
        );
        $stmt->execute(['id' => $id]);
        $invoice = $stmt->fetch();
        if ($invoice === false) {
            Response::error(404, 'not_found', 'Invoice not found.');
            exit;
        }
        Acl::require($invoice['trainer_id'] === $trainerId, 'Only the invoicing trainer can review a payment.');

        return $invoice;
    }

    private static function pendingClaim(string $invoiceId): ?string
    {
        $stmt = Database::connection()->prepare(
            "SELECT id FROM invoice_payment_claims WHERE invoice_id = :id AND status = 'pending' ORDER BY created_at DESC LIMIT 1"
        );
        $stmt->execute(['id' => $invoiceId]);
        $id = $stmt->fetchColumn();

        return $id === false ? null : (string) $id;
    }

    private static function text(mixed $value, int $max): ?string
    {
        $text = mb_substr(trim((string) $value), 0, $max);
        return $text === '' ? null : $text;
    }
}
