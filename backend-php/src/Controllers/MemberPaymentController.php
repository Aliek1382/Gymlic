<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Acl;
use Gymlic\Auth;
use Gymlic\CardInfo;
use Gymlic\Cast;
use Gymlic\Database;
use Gymlic\DiscountCodes;
use Gymlic\Discounts;
use Gymlic\Jalali;
use Gymlic\PaymentCancel;
use Gymlic\PaymentReminders;
use Gymlic\Receipts;
use Gymlic\Response;
use Gymlic\Settings;
use Gymlic\Subscriptions;
use Gymlic\TrackingCodes;
use Gymlic\Templates;
use Gymlic\Uuid;
use Gymlic\Validate;
use PDO;
use Throwable;

/**
 * An athlete paying their club for a membership plan, card-to-card.
 *
 * The club (owner or reception) saves the card the money goes to; the athlete
 * picks one of the club's active plans, pays outside the site and files the
 * payment with the tracking code, last four card digits and a receipt; a club
 * manager checks it and approves, which extends the membership (from the
 * current expiry while it still runs, else from today) and writes the amount
 * into the club's revenue ledger, or rejects it with a reason so the athlete
 * can file again.
 *
 * Needs member-payments-update.sql: without it every endpoint answers with
 * `ready: false` / 409 and the pages hide the feature.
 */
final class MemberPaymentController
{
    private static function ready(): bool
    {
        return Database::hasTable('club_payment_info') && Database::hasTable('membership_payment_requests');
    }

    private static function requireReady(): bool
    {
        if (self::ready()) {
            return true;
        }
        Response::error(409, 'member_payments_unavailable', 'به‌روزرسانی دیتابیس برای پرداخت شهریه هنوز اجرا نشده است.');
        return false;
    }

    // ---- Club: where to send the money ------------------------------------

    /** GET /clubs/{id}/payment-info */
    public static function paymentInfo(array $params): void
    {
        $user = Auth::requireUser();
        Acl::require(Acl::managesClub($user['id'], $params['id']));
        $empty = ['card_number' => '', 'sheba' => '', 'holder_name' => '', 'bank_name' => ''];

        if (!self::ready()) {
            Response::ok(['ready' => false, 'info' => $empty]);
            return;
        }
        $stmt = Database::connection()->prepare(
            'SELECT card_number, sheba, holder_name, bank_name FROM club_payment_info WHERE club_id = :id'
        );
        $stmt->execute(['id' => $params['id']]);
        $row = $stmt->fetch();

        Response::ok(['ready' => true, 'info' => $row === false ? $empty : array_map('strval', $row)]);
    }

    /** PUT /clubs/{id}/payment-info */
    public static function savePaymentInfo(array $params): void
    {
        $user = Auth::requireUser();
        Acl::require(Acl::managesClub($user['id'], $params['id']));
        if (!self::requireReady()) {
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
            'INSERT INTO club_payment_info (club_id, card_number, sheba, holder_name, bank_name)
             VALUES (:id, :card, :sheba, :holder, :bank)
             ON DUPLICATE KEY UPDATE card_number = VALUES(card_number), sheba = VALUES(sheba),
                                     holder_name = VALUES(holder_name), bank_name = VALUES(bank_name)'
        )->execute([
            'id'     => $params['id'],
            'card'   => $card !== '' ? $card : null,
            'sheba'  => $sheba !== '' ? 'IR' . $sheba : null,
            'holder' => self::text($data['holder_name'] ?? '', 100),
            'bank'   => self::text($data['bank_name'] ?? '', 60),
        ]);

        Response::ok(['ok' => true]);
    }

    // ---- Athlete ---------------------------------------------------------

    /** GET /member-payments/mine: each club the athlete belongs to, with plans, card and history. */
    public static function mine(): void
    {
        $user = Auth::requireUser();
        if (!self::ready()) {
            Response::ok(['ready' => false]);
            return;
        }

        $pdo = Database::connection();
        $billing = Settings::get('billing');
        $discounts = DiscountCodes::clubReady();
        $stmt = $pdo->prepare(
            "SELECT m.id AS membership_id, m.club_id, c.name AS club_name, m.plan_id, p.name AS plan_name, m.expires_at
             FROM memberships m
             JOIN clubs c ON c.id = m.club_id
             LEFT JOIN club_membership_plans p ON p.id = m.plan_id
             WHERE m.user_id = :id AND m.role = 'athlete' AND m.status = 'active'
             ORDER BY m.joined_at ASC"
        );
        $stmt->execute(['id' => $user['id']]);

        $clubs = [];
        foreach ($stmt->fetchAll() as $row) {
            $info = $pdo->prepare('SELECT card_number, sheba, holder_name, bank_name FROM club_payment_info WHERE club_id = :id');
            $info->execute(['id' => $row['club_id']]);
            $info = $info->fetch();

            $plans = $pdo->prepare(
                'SELECT id, name, price_toman, duration_days, description FROM club_membership_plans
                 WHERE club_id = :id AND is_active = 1 AND price_toman > 0 ORDER BY sort_order ASC, created_at ASC'
            );
            $plans->execute(['id' => $row['club_id']]);

            $paidCol = Database::hasColumn('membership_payment_requests', 'paid_amount_toman');
            $requests = $pdo->prepare(
                "SELECT r.id, r.plan_name, r.amount_toman, r.tracking_code, r.card_last4, r.paid_at, r.note, r.status,
                        r.review_note, r.reviewed_at, r.created_at, r.receipt_purged_at,
                        (r.receipt_path IS NOT NULL) AS has_receipt, (r.receipt_path LIKE '%.pdf') AS receipt_is_pdf"
                . ($paidCol ? ', r.paid_amount_toman' : '')
                . ($discounts ? ', r.list_price_toman, r.discount_toman, d.code AS discount_code' : '') . "
                 FROM membership_payment_requests r"
                . ($discounts ? ' LEFT JOIN club_discount_codes d ON d.id = r.discount_code_id' : '') . "
                 WHERE r.club_id = :club AND r.athlete_id = :athlete
                 ORDER BY r.created_at DESC LIMIT 20"
            );
            $requests->execute(['club' => $row['club_id'], 'athlete' => $user['id']]);
            $requests = Cast::rows($requests->fetchAll(), [], ['amount_toman', 'list_price_toman', 'discount_toman', 'paid_amount_toman'], ['has_receipt', 'receipt_is_pdf']);

            $expires = $row['expires_at'];
            $clubs[] = [
                'membership_id'  => $row['membership_id'],
                'club_id'        => $row['club_id'],
                'club_name'      => $row['club_name'],
                'plan_name'      => $row['plan_name'],
                'expires_at'     => $expires,
                // A DATE: the membership runs through the end of that day.
                'status'         => Subscriptions::status($expires === null ? null : $expires . ' 23:59:59', false),
                'remaining_days' => Subscriptions::remainingDays($expires === null ? null : $expires . ' 23:59:59'),
                'pay_to'         => $info === false ? null : array_map('strval', $info),
                'plans'          => Cast::rows($plans->fetchAll(), [], ['price_toman', 'duration_days']),
                'requests'       => $requests,
            ];
        }

        Response::ok([
            'ready'    => true,
            'discounts_enabled' => $discounts,
            'clubs'    => $clubs,
            'receipts' => [
                'required'       => $billing['receipt_required'],
                'max_mb'         => $billing['receipt_max_mb'],
                'retention_days' => $billing['receipt_retention_days'],
            ],
        ]);
    }

    /** POST /member-payments/discount-check {plan_id, code}: the price a club's code gives, before filing. */
    public static function checkDiscount(): void
    {
        $user = Auth::requireUser();
        $data = Validate::required(Validate::body(), ['plan_id', 'code']);
        if (!self::requireReady()) {
            return;
        }
        if (!DiscountCodes::clubReady()) {
            Response::error(409, 'discounts_unavailable', 'کد تخفیف فعلاً پذیرفته نمی‌شود.');
            return;
        }

        $pdo = Database::connection();
        $plan = self::planFor($pdo, (string) $data['plan_id'], $user['id']);
        if ($plan === null) {
            Response::error(404, 'plan_not_found', 'این طرح عضویت در دسترس نیست.');
            return;
        }

        $result = DiscountCodes::evaluate(
            $pdo, DiscountCodes::CLUB, $plan['club_id'], (string) $data['code'], (int) $plan['price_toman'], $plan['id'], $user['id']
        );
        if (!$result['ok']) {
            Response::error(409, $result['error'], $result['message']);
            return;
        }

        Response::ok([
            'code'             => $result['code']['code'],
            'list_price_toman' => $result['list_price'],
            'discount_toman'   => $result['discount'],
            'final_toman'      => $result['final'],
        ]);
    }

    /** An active plan of a club the athlete is an active athlete member of, else null. */
    private static function planFor(PDO $pdo, string $planId, string $athleteId): ?array
    {
        $plan = $pdo->prepare(
            'SELECT p.id, p.club_id, p.name, p.price_toman, p.duration_days, c.name AS club_name
             FROM club_membership_plans p JOIN clubs c ON c.id = p.club_id
             WHERE p.id = :id AND p.is_active = 1'
        );
        $plan->execute(['id' => $planId]);
        $plan = $plan->fetch();
        if ($plan === false) {
            return null;
        }
        $check = $pdo->prepare(
            "SELECT 1 FROM memberships WHERE club_id = :club AND user_id = :user AND role = 'athlete' AND status = 'active'"
        );
        $check->execute(['club' => $plan['club_id'], 'user' => $athleteId]);

        return $check->fetchColumn() !== false ? $plan : null;
    }

    /** POST /member-payments (multipart with the receipt, or JSON without). */
    public static function submit(): void
    {
        $user = Auth::requireUser();
        if (!self::requireReady()) {
            return;
        }

        $multipart = str_starts_with(strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? '')), 'multipart/form-data');
        $data = Validate::required($multipart ? $_POST : Validate::body(), ['plan_id']);

        $pdo = Database::connection();
        $plan = self::planFor($pdo, (string) $data['plan_id'], $user['id']);
        // The same answer whether the plan does not exist or is another club's.
        if ($plan === null) {
            Response::error(404, 'plan_not_found', 'این طرح عضویت در دسترس نیست.');
            return;
        }
        if ((int) $plan['price_toman'] <= 0) {
            Response::error(400, 'free_plan', 'این طرح رایگان است و نیازی به پرداخت ندارد.');
            return;
        }

        $waiting = $pdo->prepare(
            "SELECT 1 FROM membership_payment_requests WHERE club_id = :club AND athlete_id = :user AND status = 'pending'"
        );
        $waiting->execute(['club' => $plan['club_id'], 'user' => $user['id']]);
        if ($waiting->fetchColumn() !== false) {
            Response::error(409, 'request_pending', 'پرداخت قبلی شما هنوز در انتظار تأیید باشگاه است.');
            return;
        }

        // A club's discount code, checked now (so a bad one stops before the
        // receipt is stored) and again, with the code locked, when filed.
        $code = Discounts::normalizeCode($data['discount_code'] ?? '');
        if ($code !== '' && !DiscountCodes::clubReady()) {
            Response::error(409, 'discounts_unavailable', 'کد تخفیف فعلاً پذیرفته نمی‌شود.');
            return;
        }
        if ($code !== '') {
            $quote = DiscountCodes::evaluate(
                $pdo, DiscountCodes::CLUB, $plan['club_id'], $code, (int) $plan['price_toman'], $plan['id'], $user['id']
            );
            if (!$quote['ok']) {
                Response::error(409, $quote['error'], $quote['message']);
                return;
            }
        }

        $fields = Receipts::parseFields($data, Database::hasColumn('membership_payment_requests', 'paid_amount_toman'));
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
        $row = [
            'id'            => $id,
            'club_id'       => $plan['club_id'],
            'athlete_id'    => $user['id'],
            'plan_id'       => $plan['id'],
            // The plan as it is now: the club may edit or delete it later.
            'plan_name'     => $plan['name'],
            'duration_days' => (int) $plan['duration_days'],
            'amount_toman'  => (int) $plan['price_toman'],
            'tracking_code' => $fields['row']['tracking_code'],
            'card_last4'    => $fields['row']['card_last4'],
            'paid_at'       => $fields['row']['paid_at'],
            'note'          => self::text($data['note'] ?? '', 500),
            'receipt_path'  => $file,
        ];
        if (isset($fields['row']['paid_amount_toman'])) {
            $row['paid_amount_toman'] = $fields['row']['paid_amount_toman'];
        }

        $pdo->beginTransaction();
        try {
            if ($code !== '') {
                $locked = DiscountCodes::evaluate(
                    $pdo, DiscountCodes::CLUB, $plan['club_id'], $code, (int) $plan['price_toman'], $plan['id'], $user['id'], true
                );
                if (!$locked['ok']) {
                    $pdo->rollBack();
                    Receipts::remove($file);
                    Response::error(409, $locked['error'], $locked['message']);
                    return;
                }
                $row['amount_toman'] = $locked['final'];
                $row += [
                    'discount_code_id' => $locked['code']['id'],
                    'list_price_toman' => $locked['list_price'],
                    'discount_toman'   => $locked['discount'],
                ];
            }
            $pdo->prepare(
                'INSERT INTO membership_payment_requests (' . implode(', ', array_keys($row)) . ')
                 VALUES (:' . implode(', :', array_keys($row)) . ')'
            )->execute($row);
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            Receipts::remove($file);
            throw $e;
        }

        try {
            foreach (self::managers($pdo, $plan['club_id']) as $managerId) {
                Templates::notify(
                    $pdo,
                    'member_payment_submitted',
                    $managerId,
                    $user['id'],
                    'broadcast',
                    ['name' => trim($user['first_name'] . ' ' . $user['last_name']) ?: 'ورزشکار', 'plan' => $plan['name']],
                    '/member-payments'
                );
            }
        } catch (Throwable $e) {
            error_log('member payment notice: ' . $e->getMessage());
        }
        if ($file !== null) {
            Receipts::purgeIfDue($pdo);
        }

        Response::ok(['id' => $id], 201);
    }

    /** GET /member-payments/{id}/receipt: the athlete who filed it, or a manager of the club. */
    public static function receipt(array $params): void
    {
        $user = Auth::requireUser();
        $path = null;

        if (self::ready()) {
            $stmt = Database::connection()->prepare(
                'SELECT club_id, athlete_id, receipt_path FROM membership_payment_requests WHERE id = :id'
            );
            $stmt->execute(['id' => $params['id']]);
            $row = $stmt->fetch();
            if ($row !== false && ($row['athlete_id'] === $user['id'] || Acl::managesClub($user['id'], $row['club_id']))) {
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

    // ---- Club managers ---------------------------------------------------

    /** GET /clubs/{id}/member-payments */
    public static function clubList(array $params): void
    {
        $user = Auth::requireUser();
        Acl::require(Acl::managesClub($user['id'], $params['id']));
        if (!self::ready()) {
            Response::ok(['ready' => false, 'items' => []]);
            return;
        }

        $pdo = Database::connection();
        PaymentReminders::sendIfDue($pdo);
        $discounts = DiscountCodes::clubReady();
        $paidCol = Database::hasColumn('membership_payment_requests', 'paid_amount_toman');
        $stmt = $pdo->prepare(
            "SELECT r.id, r.athlete_id, r.plan_name, r.duration_days, r.amount_toman, r.tracking_code, r.card_last4,
                    r.paid_at, r.note, r.status, r.review_note, r.reviewed_at, r.created_at, r.receipt_purged_at,
                    (r.receipt_path IS NOT NULL) AS has_receipt, (r.receipt_path LIKE '%.pdf') AS receipt_is_pdf,
                    a.first_name, a.last_name, a.phone,
                    " . TrackingCodes::duplicateExpr('membership_payment_requests', 'r') . " AS duplicate_tracking"
            . ($paidCol ? ', r.paid_amount_toman, (r.paid_amount_toman IS NOT NULL AND r.paid_amount_toman <> r.amount_toman) AS amount_mismatch' : '')
            . ($discounts ? ', r.list_price_toman, r.discount_toman, d.code AS discount_code' : '') . "
             FROM membership_payment_requests r
             JOIN profiles a ON a.id = r.athlete_id"
            . ($discounts ? ' LEFT JOIN club_discount_codes d ON d.id = r.discount_code_id' : '') . "
             WHERE r.club_id = :club ORDER BY r.created_at DESC LIMIT 500"
        );
        $stmt->execute(['club' => $params['id']]);
        $rows = Cast::rows($stmt->fetchAll(), [], ['amount_toman', 'duration_days', 'list_price_toman', 'discount_toman', 'paid_amount_toman'], ['has_receipt', 'receipt_is_pdf', 'duplicate_tracking', 'amount_mismatch']);

        // When the file goes: the retention days after the review.
        $days = Settings::get('billing')['receipt_retention_days'];
        foreach ($rows as &$row) {
            $row['receipt_expires_at'] = ($row['has_receipt'] && $days > 0 && $row['reviewed_at'] !== null)
                ? date('Y-m-d H:i:s', (int) strtotime($row['reviewed_at']) + $days * 86400)
                : null;
        }
        unset($row);
        Receipts::purgeIfDue($pdo);

        Response::ok(['ready' => true, 'items' => $rows]);
    }

    /**
     * POST /member-payments/{id}/approve: the money arrived. Extends the
     * membership, records the amount in the club's revenue, tells the athlete.
     */
    public static function approve(array $params): void
    {
        $user = Auth::requireUser();
        if (!self::requireReady()) {
            return;
        }
        $note = self::text(Validate::body()['note'] ?? '', 500);

        $pdo = Database::connection();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare(
                "SELECT r.*, c.name AS club_name FROM membership_payment_requests r
                 JOIN clubs c ON c.id = r.club_id
                 WHERE r.id = :id AND r.status = 'pending' FOR UPDATE"
            );
            $stmt->execute(['id' => $params['id']]);
            $request = $stmt->fetch();
            if ($request === false) {
                $pdo->rollBack();
                Response::error(409, 'request_not_pending', 'این پرداخت در انتظار بررسی نیست.');
                return;
            }
            if (!Acl::managesClub($user['id'], $request['club_id'])) {
                $pdo->rollBack();
                Response::error(403, 'forbidden', 'فقط مدیر یا پذیرش باشگاه می‌تواند پرداخت را بررسی کند.');
                return;
            }

            $member = $pdo->prepare(
                "SELECT id, expires_at FROM memberships
                 WHERE club_id = :club AND user_id = :user AND role = 'athlete' FOR UPDATE"
            );
            $member->execute(['club' => $request['club_id'], 'user' => $request['athlete_id']]);
            $member = $member->fetch();
            if ($member === false) {
                $pdo->rollBack();
                Response::error(409, 'membership_gone', 'این ورزشکار دیگر عضو باشگاه نیست.');
                return;
            }

            // Counted from the current expiry while it still runs, so renewing
            // early costs the athlete nothing; else from today.
            $today = date('Y-m-d');
            $base = ($member['expires_at'] !== null && $member['expires_at'] > $today) ? $member['expires_at'] : $today;
            $expiresAt = date('Y-m-d', (int) strtotime($base . ' +' . (int) $request['duration_days'] . ' days'));

            $pdo->prepare('UPDATE memberships SET expires_at = :expires, plan_id = COALESCE(:plan, plan_id) WHERE id = :id')
                ->execute(['expires' => $expiresAt, 'plan' => $request['plan_id'], 'id' => $member['id']]);

            $pdo->prepare(
                "INSERT INTO revenue_entries (id, club_id, amount, member_id, category, note, recorded_by, occurred_at)
                 VALUES (:id, :club, :amount, :member, 'membership', :note, :by, :on)"
            )->execute([
                'id'     => Uuid::v4(),
                'club'   => $request['club_id'],
                'amount' => $request['amount_toman'],
                'member' => $request['athlete_id'],
                'note'   => mb_substr(
                    'پرداخت کارت‌به‌کارت · ' . $request['plan_name'] . ' · کد پیگیری ' . $request['tracking_code']
                    . ((int) ($request['discount_toman'] ?? 0) > 0 ? ' · با ' . number_format((int) $request['discount_toman']) . ' تومان تخفیف' : ''),
                    0,
                    500
                ),
                'by'     => $user['id'],
                'on'     => $today,
            ]);

            $pdo->prepare(
                "UPDATE membership_payment_requests
                 SET status = 'approved', review_note = :note, reviewed_by = :by, reviewed_at = NOW() WHERE id = :id"
            )->execute(['note' => $note, 'by' => $user['id'], 'id' => $request['id']]);

            Templates::notify(
                $pdo,
                'member_payment_approved',
                $request['athlete_id'],
                $user['id'],
                'broadcast',
                ['club' => $request['club_name'], 'date' => Jalali::format($expiresAt, true)],
                '/membership'
            );
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        Response::ok(['ok' => true, 'expires_at' => $expiresAt]);
    }

    /** POST /member-payments/{id}/reject {note} */
    public static function reject(array $params): void
    {
        $user = Auth::requireUser();
        if (!self::requireReady()) {
            return;
        }
        $note = self::text(Validate::body()['note'] ?? '', 500);

        $pdo = Database::connection();
        $stmt = $pdo->prepare(
            "SELECT r.club_id, r.athlete_id, c.name AS club_name FROM membership_payment_requests r
             JOIN clubs c ON c.id = r.club_id WHERE r.id = :id AND r.status = 'pending'"
        );
        $stmt->execute(['id' => $params['id']]);
        $request = $stmt->fetch();
        if ($request === false) {
            Response::error(409, 'request_not_pending', 'این پرداخت در انتظار بررسی نیست.');
            return;
        }
        Acl::require(Acl::managesClub($user['id'], $request['club_id']));

        $update = $pdo->prepare(
            "UPDATE membership_payment_requests SET status = 'rejected', review_note = :note, reviewed_by = :by, reviewed_at = NOW()
             WHERE id = :id AND status = 'pending'"
        );
        $update->execute(['note' => $note, 'by' => $user['id'], 'id' => $params['id']]);
        if ($update->rowCount() === 0) {
            Response::error(409, 'request_not_pending', 'این پرداخت در انتظار بررسی نیست.');
            return;
        }

        Templates::notify(
            $pdo,
            'member_payment_rejected',
            $request['athlete_id'],
            $user['id'],
            'broadcast',
            ['club' => $request['club_name'], 'reason' => $note ?? 'برای پیگیری با باشگاه صحبت کنید.'],
            '/membership'
        );

        Response::ok(['ok' => true]);
    }

    /** DELETE /member-payments/{id}: the athlete takes back a request the club has not answered. */
    public static function cancel(array $params): void
    {
        $user = Auth::requireUser();
        PaymentCancel::respond(PaymentCancel::own('membership_payment_requests', $params['id'], $user['id']));
    }

    /** DELETE /member-payments/{id}/receipt: remove one file now. */
    public static function deleteReceipt(array $params): void
    {
        $user = Auth::requireUser();
        if (!self::requireReady()) {
            return;
        }

        $pdo = Database::connection();
        $stmt = $pdo->prepare('SELECT club_id, receipt_path FROM membership_payment_requests WHERE id = :id');
        $stmt->execute(['id' => $params['id']]);
        $row = $stmt->fetch();
        if ($row === false || !Acl::managesClub($user['id'], $row['club_id']) || $row['receipt_path'] === null) {
            Response::error(404, 'not_found', 'این پرداخت رسیدی ندارد.');
            return;
        }

        $freed = Receipts::remove($row['receipt_path']);
        $pdo->prepare('UPDATE membership_payment_requests SET receipt_path = NULL, receipt_purged_at = NOW() WHERE id = :id')
            ->execute(['id' => $params['id']]);

        Response::ok(['ok' => true, 'freed_bytes' => $freed]);
    }

    // ---- Helpers ---------------------------------------------------------

    /** The club owner and its active reception staff: who reviews a payment. @return list<string> */
    private static function managers(PDO $pdo, string $clubId): array
    {
        $stmt = $pdo->prepare(
            "SELECT owner_id FROM clubs WHERE id = :club
             UNION
             SELECT user_id FROM memberships WHERE club_id = :club2 AND role IN ('owner', 'reception') AND status = 'active'"
        );
        $stmt->execute(['club' => $clubId, 'club2' => $clubId]);

        return array_values(array_unique(array_map('strval', $stmt->fetchAll(PDO::FETCH_COLUMN))));
    }

    private static function text(mixed $value, int $max): ?string
    {
        $text = mb_substr(trim((string) $value), 0, $max);
        return $text === '' ? null : $text;
    }
}
