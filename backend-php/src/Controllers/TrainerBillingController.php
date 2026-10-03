<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\AdminAccess;
use Gymlic\Auth;
use Gymlic\Cast;
use Gymlic\Database;
use Gymlic\Discounts;
use Gymlic\Jalali;
use Gymlic\Limits;
use Gymlic\PaymentCancel;
use Gymlic\PaymentReminders;
use Gymlic\Receipts;
use Gymlic\Response;
use Gymlic\Settings;
use Gymlic\Subscriptions;
use Gymlic\Templates;
use Gymlic\Tiers;
use Gymlic\TrainerBilling;
use Gymlic\TrackingCodes;
use Gymlic\TrainerDiscounts;
use Gymlic\Uuid;
use Gymlic\Validate;
use PDO;
use Throwable;

/**
 * A trainer paying the platform for their own subscription, card-to-card:
 * the trainer picks a plan, pays to the platform's card (the same one clubs
 * pay to, from the admin's billing settings) and files a request with the
 * tracking code, last four card digits and a receipt; an admin who handles
 * payments approves it (which starts or extends the subscription) or rejects
 * it with a reason. See TrainerBilling for what a subscription is worth.
 *
 * Needs trainer-billing-update.sql: without it every endpoint answers with
 * `ready: false` / 409 and the pages hide the feature.
 */
final class TrainerBillingController
{
    // ---- Trainer ---------------------------------------------------------

    /** GET /trainer-billing: everything the "my subscription" page shows. */
    public static function overview(): void
    {
        $user = self::requireTrainer();
        if (!TrainerBilling::ready()) {
            Response::ok(['ready' => false]);
            return;
        }

        $pdo = Database::connection();
        $billing = Settings::get('billing');
        TrainerBilling::remindIfDue($pdo);

        // The free plan is what a trainer has without paying: never on sale.
        $plans = $pdo->query(
            'SELECT id, name, price_toman, duration_days, max_athletes' . (Limits::ready() ? ', max_custom_exercises, max_templates, history_months, report_level' : '') . '
             FROM trainer_plans WHERE is_active = 1' . (Limits::ready() ? ' AND is_free = 0' : '') . ' ORDER BY price_toman ASC'
        )->fetchAll();

        $discounts = TrainerDiscounts::ready();
        $paidCol = Database::hasColumn('trainer_payment_requests', 'paid_amount_toman');
        $stmt = $pdo->prepare(
            'SELECT r.id, r.plan_id, r.amount_toman, r.reference_note, r.tracking_code, r.card_last4, r.paid_at,
                    r.status, r.admin_note, r.reviewed_at, r.created_at, r.receipt_purged_at,
                    (r.receipt_path IS NOT NULL) AS has_receipt, (r.receipt_path LIKE \'%.pdf\') AS receipt_is_pdf,
                    p.name AS plan_name'
            . ($paidCol ? ', r.paid_amount_toman' : '')
            . ($discounts ? ', r.list_price_toman, r.discount_toman, dc.code AS discount_code' : '') . '
             FROM trainer_payment_requests r JOIN trainer_plans p ON p.id = r.plan_id'
            . ($discounts ? ' LEFT JOIN trainer_discount_codes dc ON dc.id = r.discount_code_id' : '') . '
             WHERE r.trainer_id = :id ORDER BY r.created_at DESC LIMIT 50'
        );
        $stmt->execute(['id' => $user['id']]);

        Response::ok([
            'ready'        => true,
            'enforcing'    => $billing['trainer_enforce'],
            'in_club'      => TrainerBilling::inClub($pdo, $user['id']),
            'subscription' => TrainerBilling::subscription($pdo, $user['id']),
            'athletes'     => TrainerBilling::athleteCounts($pdo, $user['id']),
            'limits'       => Limits::forTrainer($pdo, $user['id']),
            'plans'        => Cast::rows($plans, [], ['price_toman', 'duration_days', 'max_athletes', 'max_custom_exercises', 'max_templates', 'history_months']),
            'discounts_enabled' => $discounts,
            'requests'     => Cast::rows($stmt->fetchAll(), [], ['amount_toman', 'list_price_toman', 'discount_toman', 'paid_amount_toman'], ['has_receipt', 'receipt_is_pdf']),
            'receipts'     => [
                'required'       => $billing['receipt_required'],
                'max_mb'         => $billing['receipt_max_mb'],
                'retention_days' => $billing['receipt_retention_days'],
            ],
            'payment'      => [
                'card_number'    => $billing['card_number'],
                'sheba'          => $billing['sheba'],
                'account_holder' => $billing['account_holder'],
                'bank_name'      => $billing['bank_name'],
                'instructions'   => $billing['instructions'],
            ],
        ]);
    }

    /** POST /trainer-billing/requests (multipart with the receipt, or JSON without). */
    public static function submit(): void
    {
        $user = self::requireTrainer();
        if (!self::ready()) {
            return;
        }

        $multipart = str_starts_with(strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? '')), 'multipart/form-data');
        $data = Validate::required($multipart ? $_POST : Validate::body(), ['plan_id']);

        $pdo = Database::connection();
        $plan = $pdo->prepare('SELECT id, name, price_toman FROM trainer_plans WHERE id = :id AND is_active = 1' . self::notFree());
        $plan->execute(['id' => (string) $data['plan_id']]);
        $plan = $plan->fetch();
        if ($plan === false) {
            Response::error(404, 'plan_not_found', 'این پلن در دسترس نیست.');
            return;
        }

        $waiting = $pdo->prepare("SELECT 1 FROM trainer_payment_requests WHERE trainer_id = :id AND status = 'pending'");
        $waiting->execute(['id' => $user['id']]);
        if ($waiting->fetchColumn() !== false) {
            Response::error(409, 'request_pending', 'پرداخت قبلی شما هنوز در انتظار بررسی است.');
            return;
        }

        // A discount code, checked now so we know whether anything is left to
        // pay, and again inside the transaction with the code row locked.
        $code = Discounts::normalizeCode($data['discount_code'] ?? '');
        if ($code !== '' && !TrainerDiscounts::ready()) {
            Response::error(409, 'discounts_unavailable', 'کد تخفیف فعلاً پذیرفته نمی‌شود.');
            return;
        }
        $quote = null;
        if ($code !== '') {
            $quote = TrainerDiscounts::evaluate($pdo, $code, $plan, $user['id']);
            if (!$quote['ok']) {
                Response::error(409, $quote['error'], $quote['message']);
                return;
            }
        }

        // A code that covers the whole price leaves nothing to pay: no tracking
        // code or receipt, just a request for the admin to approve.
        $free = $quote !== null && $quote['final'] === 0;
        $billing = Settings::get('billing');
        $file = null;
        if ($free) {
            $fields = ['row' => ['tracking_code' => 'DISCOUNT', 'card_last4' => '0000', 'paid_at' => null]];
        } else {
            $fields = Receipts::parseFields($data, Database::hasColumn('trainer_payment_requests', 'paid_amount_toman'));
            if (isset($fields['error'])) {
                Response::error(400, $fields['error'][0], $fields['error'][1]);
                return;
            }

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
        }

        $id = Uuid::v4();
        $row = [
            'id'            => $id,
            'trainer_id'    => $user['id'],
            'plan_id'       => $plan['id'],
            // The plan's price at this moment: the admin may edit it later.
            'amount_toman'  => (int) $plan['price_toman'],
            'reference_note' => self::text($data['reference_note'] ?? '', 500),
            'tracking_code' => $fields['row']['tracking_code'],
            'card_last4'    => $fields['row']['card_last4'],
            'paid_at'       => $fields['row']['paid_at'],
            'receipt_path'  => $file,
        ];
        if (isset($fields['row']['paid_amount_toman'])) {
            $row['paid_amount_toman'] = $fields['row']['paid_amount_toman'];
        }

        $pdo->beginTransaction();
        try {
            if ($quote !== null) {
                // Again, with the code locked: it may have run out since.
                $locked = TrainerDiscounts::evaluate($pdo, $code, $plan, $user['id'], true);
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
                'INSERT INTO trainer_payment_requests (' . implode(', ', array_keys($row)) . ')
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
            foreach (AdminAccess::holders($pdo, 'finance.payments') as $adminId) {
                Templates::notify(
                    $pdo,
                    'trainer_payment_submitted',
                    $adminId,
                    $user['id'],
                    'broadcast',
                    [
                        'name'   => trim($user['first_name'] . ' ' . $user['last_name']) ?: 'مربی',
                        'amount' => number_format((int) $row['amount_toman']),
                    ],
                    '/admin/trainer-billing'
                );
            }
        } catch (Throwable $e) {
            error_log('trainer payment notice: ' . $e->getMessage());
        }
        if ($file !== null) {
            Receipts::purgeIfDue($pdo);
        }

        Response::ok(['id' => $id], 201);
    }

    /** POST /trainer-billing/discount-check {plan_id, code}: the price a code gives, before filing. */
    public static function checkDiscount(): void
    {
        $user = self::requireTrainer();
        $data = Validate::required(Validate::body(), ['code', 'plan_id']);
        if (!self::ready()) {
            return;
        }
        if (!TrainerDiscounts::ready()) {
            Response::error(409, 'discounts_unavailable', 'کد تخفیف فعلاً پذیرفته نمی‌شود.');
            return;
        }

        $pdo = Database::connection();
        $plan = $pdo->prepare('SELECT id, name, price_toman FROM trainer_plans WHERE id = :id AND is_active = 1' . self::notFree());
        $plan->execute(['id' => (string) $data['plan_id']]);
        $plan = $plan->fetch();
        if ($plan === false) {
            Response::error(404, 'plan_not_found', 'این پلن در دسترس نیست.');
            return;
        }

        $result = TrainerDiscounts::evaluate($pdo, (string) $data['code'], $plan, $user['id']);
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

    /** GET /trainer-billing/requests/{id}/receipt: the trainer who filed it, or a finance admin. */
    public static function receipt(array $params): void
    {
        $user = Auth::requireUser();
        $path = null;

        if (TrainerBilling::ready()) {
            $stmt = Database::connection()->prepare('SELECT trainer_id, receipt_path FROM trainer_payment_requests WHERE id = :id');
            $stmt->execute(['id' => $params['id']]);
            $row = $stmt->fetch();
            if ($row !== false && ($row['trainer_id'] === $user['id'] || AdminAccess::can($user, 'finance.payments'))) {
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

    /** DELETE /trainer-billing/requests/{id}: the trainer takes back a request nobody has answered. */
    public static function cancel(array $params): void
    {
        $user = Auth::requireUser();
        PaymentCancel::respond(PaymentCancel::own('trainer_payment_requests', $params['id'], $user['id']));
    }

    /**
     * GET /trainer-billing/athletes: the athletes the trainer coaches outside
     * a club, for choosing which stay active on the free plan.
     */
    public static function athletes(): void
    {
        $user = self::requireTrainer();
        if (!Limits::ready()) {
            Response::ok(['ready' => false, 'items' => []]);
            return;
        }

        $pdo = Database::connection();
        $limits = Limits::forTrainer($pdo, $user['id']);
        $stmt = $pdo->prepare(
            "SELECT ta.athlete_id AS id, p.first_name, p.last_name, p.avatar_url, p.last_seen_at,
                    ta.suspended_by_plan, ta.keep_on_downgrade, ta.created_at
             FROM trainer_athletes ta JOIN profiles p ON p.id = ta.athlete_id
             WHERE ta.trainer_id = :id AND ta.club_id IS NULL AND ta.status = 'active'
             ORDER BY ta.keep_on_downgrade DESC, p.last_seen_at IS NULL, p.last_seen_at DESC, ta.created_at DESC"
        );
        $stmt->execute(['id' => $user['id']]);

        Response::ok([
            'ready'  => true,
            'limits' => $limits,
            'items'  => Cast::rows($stmt->fetchAll(), [], [], ['suspended_by_plan', 'keep_on_downgrade']),
        ]);
    }

    /**
     * POST /trainer-billing/athletes {keep: [athlete ids]}: who stays active
     * on the free plan (up to its cap). Saved for later while a paid plan or
     * its grace days run; applied at once when already on the free plan.
     */
    public static function saveKeepList(): void
    {
        $user = self::requireTrainer();
        if (!Limits::ready()) {
            Response::error(409, 'limits_unavailable', 'به‌روزرسانی دیتابیس برای پلن‌ها هنوز اجرا نشده است.');
            return;
        }
        $keep = Validate::body()['keep'] ?? null;
        if (!is_array($keep)) {
            Response::error(400, 'invalid_body', 'keep must be a list of athlete ids.');
            return;
        }
        $keep = array_values(array_unique(array_map('strval', $keep)));

        $pdo = Database::connection();
        $cap = Limits::freePlan($pdo)['max_athletes'];
        if ($cap !== null && count($keep) > $cap) {
            Response::error(400, 'too_many', 'در پلن رایگان حداکثر ' . $cap . ' ورزشکار فعال می‌ماند.');
            return;
        }

        $pdo->beginTransaction();
        try {
            $pdo->prepare('UPDATE trainer_athletes SET keep_on_downgrade = 0 WHERE trainer_id = :id')
                ->execute(['id' => $user['id']]);
            $mark = $pdo->prepare(
                "UPDATE trainer_athletes SET keep_on_downgrade = 1
                 WHERE trainer_id = :id AND athlete_id = :athlete AND club_id IS NULL AND status = 'active'"
            );
            foreach ($keep as $athleteId) {
                $mark->execute(['id' => $user['id'], 'athlete' => $athleteId]);
            }

            $limits = Limits::forTrainer($pdo, $user['id']);
            if ($limits['status'] === 'expired' && ($limits['subscription']['downgraded'] ?? false)) {
                Limits::applyKeepList($pdo, $user['id']);
            }
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        Response::ok(['ok' => true]);
    }

    // ---- Admin: payment requests -----------------------------------------

    /** GET /admin/trainer-billing/requests[?trainer_id=] — every trainer's, or one trainer's (their admin page). */
    public static function adminRequests(): void
    {
        Auth::requireAdmin('finance.payments');
        $trainerId = isset($_GET['trainer_id']) && is_string($_GET['trainer_id']) ? $_GET['trainer_id'] : null;
        if (!TrainerBilling::ready()) {
            Response::ok(['ready' => false, 'items' => []]);
            return;
        }

        $pdo = Database::connection();
        PaymentReminders::sendIfDue($pdo);
        $discounts = TrainerDiscounts::ready();
        $paidCol = Database::hasColumn('trainer_payment_requests', 'paid_amount_toman');
        $stmt = $pdo->prepare(
            "SELECT r.id, r.trainer_id, r.plan_id, r.amount_toman, r.reference_note, r.tracking_code, r.card_last4,
                    r.paid_at, r.status, r.admin_note, r.reviewed_at, r.created_at, r.receipt_purged_at,
                    (r.receipt_path IS NOT NULL) AS has_receipt, (r.receipt_path LIKE '%.pdf') AS receipt_is_pdf,
                    p.name AS plan_name, t.first_name, t.last_name, t.phone,
                    " . TrackingCodes::duplicateExpr('trainer_payment_requests', 'r') . " AS duplicate_tracking"
            . ($paidCol ? ', r.paid_amount_toman, (r.paid_amount_toman IS NOT NULL AND r.paid_amount_toman <> r.amount_toman) AS amount_mismatch' : '')
            . ($discounts ? ', r.list_price_toman, r.discount_toman, dc.code AS discount_code' : '') . "
             FROM trainer_payment_requests r
             JOIN trainer_plans p ON p.id = r.plan_id
             JOIN profiles t ON t.id = r.trainer_id"
            . ($discounts ? ' LEFT JOIN trainer_discount_codes dc ON dc.id = r.discount_code_id' : '')
            . ($trainerId !== null ? ' WHERE r.trainer_id = :trainer_id' : '') . "
             ORDER BY r.created_at DESC LIMIT 500"
        );
        $stmt->execute($trainerId !== null ? ['trainer_id' => $trainerId] : []);
        $rows = $stmt->fetchAll();
        $rows = Cast::rows($rows, [], ['amount_toman', 'list_price_toman', 'discount_toman', 'paid_amount_toman'], ['has_receipt', 'receipt_is_pdf', 'duplicate_tracking', 'amount_mismatch']);

        // When the file goes: the retention days after the review.
        $days = Settings::get('billing')['receipt_retention_days'];
        foreach ($rows as &$row) {
            $row['receipt_expires_at'] = ($row['has_receipt'] && $days > 0 && $row['reviewed_at'] !== null)
                ? date('Y-m-d H:i:s', (int) strtotime($row['reviewed_at']) + $days * 86400)
                : null;
        }
        unset($row);
        Receipts::purgeIfDue($pdo);
        TrainerBilling::remindIfDue($pdo);

        Response::ok(['ready' => true, 'items' => $rows]);
    }

    /** POST /admin/trainer-billing/requests/{id}/approve: starts or extends the subscription. */
    public static function approve(array $params): void
    {
        $admin = Auth::requireAdmin('finance.payments');
        if (!self::ready()) {
            return;
        }
        $note = self::text(Validate::body()['admin_note'] ?? '', 500);

        $pdo = Database::connection();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare(
                "SELECT r.*, p.name AS plan_name, p.duration_days, p.max_athletes
                 FROM trainer_payment_requests r JOIN trainer_plans p ON p.id = r.plan_id
                 WHERE r.id = :id AND r.status = 'pending' FOR UPDATE"
            );
            $stmt->execute(['id' => $params['id']]);
            $request = $stmt->fetch();
            if ($request === false) {
                $pdo->rollBack();
                Response::error(409, 'request_not_pending', 'این درخواست در انتظار بررسی نیست.');
                return;
            }

            // The same plan extends the current period; another plan starts
            // now with its full period (TrainerBilling::extend).
            $before = Limits::forTrainer($pdo, $request['trainer_id']);
            $expiresAt = TrainerBilling::extend(
                $pdo,
                $request['trainer_id'],
                (int) $request['duration_days'],
                $request['plan_name'],
                $request['max_athletes'] === null ? null : (int) $request['max_athletes'],
                $request['plan_id']
            );
            Tiers::setTrainerTier($pdo, $request['trainer_id'], Tiers::planTier($pdo, 'trainer_plans', $request['plan_id']));
            $pdo->prepare(
                "UPDATE trainer_payment_requests
                 SET status = 'approved', admin_note = :note, reviewed_by = :admin, reviewed_at = NOW() WHERE id = :id"
            )->execute(['note' => $note, 'admin' => $admin['id'], 'id' => $request['id']]);

            AdminController::logActivity($pdo, null, $admin['id'], $request['trainer_id'], 'trainer_payment_approved', [
                'request_id' => $request['id'],
                'plan'       => $request['plan_name'],
                'amount'     => (int) $request['amount_toman'],
                'before'     => PlanAccountsController::snapshot($before),
                'expires_at' => $expiresAt,
                'note'       => $note,
            ]);

            Templates::notify(
                $pdo,
                'trainer_payment_approved',
                $request['trainer_id'],
                $admin['id'],
                'broadcast',
                ['date' => Jalali::format($expiresAt, true)],
                '/subscription'
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

    /** POST /admin/trainer-billing/requests/{id}/reject */
    public static function reject(array $params): void
    {
        $admin = Auth::requireAdmin('finance.payments');
        if (!self::ready()) {
            return;
        }
        $note = self::text(Validate::body()['admin_note'] ?? '', 500);

        $pdo = Database::connection();
        $stmt = $pdo->prepare(
            "UPDATE trainer_payment_requests SET status = 'rejected', admin_note = :note, reviewed_by = :admin, reviewed_at = NOW()
             WHERE id = :id AND status = 'pending'"
        );
        $stmt->execute(['note' => $note, 'admin' => $admin['id'], 'id' => $params['id']]);
        if ($stmt->rowCount() === 0) {
            Response::error(409, 'request_not_pending', 'این درخواست در انتظار بررسی نیست.');
            return;
        }

        $trainer = $pdo->prepare('SELECT trainer_id FROM trainer_payment_requests WHERE id = :id');
        $trainer->execute(['id' => $params['id']]);
        $trainerId = $trainer->fetchColumn();
        AdminController::logActivity($pdo, null, $admin['id'], $trainerId === false ? null : (string) $trainerId, 'trainer_payment_rejected', [
            'request_id' => $params['id'],
            'note'       => $note,
        ]);
        if ($trainerId !== false) {
            Templates::notify(
                $pdo,
                'trainer_payment_rejected',
                (string) $trainerId,
                $admin['id'],
                'broadcast',
                ['reason' => $note ?? 'برای پیگیری با پشتیبانی تماس بگیرید.'],
                '/subscription'
            );
        }

        Response::ok(['ok' => true]);
    }

    /** DELETE /admin/trainer-billing/requests/{id}/receipt: remove one file now. */
    public static function deleteReceipt(array $params): void
    {
        Auth::requireAdmin('finance.payments');
        if (!self::ready()) {
            return;
        }

        $pdo = Database::connection();
        $stmt = $pdo->prepare('SELECT receipt_path FROM trainer_payment_requests WHERE id = :id');
        $stmt->execute(['id' => $params['id']]);
        $row = $stmt->fetch();
        if ($row === false || $row['receipt_path'] === null) {
            Response::error(404, 'not_found', 'این درخواست رسیدی ندارد.');
            return;
        }

        $freed = Receipts::remove($row['receipt_path']);
        $pdo->prepare('UPDATE trainer_payment_requests SET receipt_path = NULL, receipt_purged_at = NOW() WHERE id = :id')
            ->execute(['id' => $params['id']]);

        Response::ok(['ok' => true, 'freed_bytes' => $freed]);
    }

    // ---- Admin: plans ----------------------------------------------------

    /** GET /admin/trainer-plans */
    public static function adminPlans(): void
    {
        Auth::requireAdmin('finance.plans');
        if (!TrainerBilling::ready()) {
            Response::ok(['ready' => false, 'items' => []]);
            return;
        }

        $limits = Limits::ready();
        $rows = Database::connection()->query(
            'SELECT id, name, price_toman, duration_days, max_athletes, is_active'
            . ($limits ? ', is_free, max_custom_exercises, max_templates, history_months, report_level,
                (SELECT COUNT(*) FROM trainer_subscriptions s WHERE s.plan_id = trainer_plans.id) AS subscriber_count' : '') . '
             FROM trainer_plans ORDER BY is_active DESC, price_toman ASC'
        )->fetchAll();

        Response::ok([
            'ready'  => true,
            'limits' => $limits,
            'items'  => Cast::rows(
                $rows,
                [],
                ['price_toman', 'duration_days', 'max_athletes', 'max_custom_exercises', 'max_templates', 'history_months', 'subscriber_count'],
                ['is_active', 'is_free']
            ),
        ]);
    }

    /** POST /admin/trainer-plans */
    public static function createPlan(): void
    {
        Auth::requireAdmin('finance.plans');
        if (!self::ready()) {
            return;
        }
        $plan = self::planFields(Validate::body(), true);
        if ($plan === null) {
            return;
        }

        $row = ['id' => Uuid::v4(), 'is_active' => 1] + $plan;
        Database::connection()->prepare(
            'INSERT INTO trainer_plans (' . implode(', ', array_keys($row)) . ')
             VALUES (:' . implode(', :', array_keys($row)) . ')'
        )->execute($row);
        $id = $row['id'];

        Response::ok(['id' => $id], 201);
    }

    /** PATCH /admin/trainer-plans/{id} */
    public static function updatePlan(array $params): void
    {
        Auth::requireAdmin('finance.plans');
        if (!self::ready()) {
            return;
        }
        $plan = self::planFields(Validate::body(), false);
        if ($plan === null) {
            return;
        }
        if ($plan === []) {
            Response::error(400, 'no_fields', 'Nothing to update.');
            return;
        }

        $pdo = Database::connection();
        if (Limits::ready()) {
            $free = $pdo->prepare('SELECT is_free FROM trainer_plans WHERE id = :id');
            $free->execute(['id' => $params['id']]);
            // The free plan is everyone's fallback: always on, always free.
            if ((int) $free->fetchColumn() === 1
                && ((isset($plan['is_active']) && $plan['is_active'] === 0) || (isset($plan['price_toman']) && $plan['price_toman'] !== 0))) {
                Response::error(409, 'free_plan_locked', 'پلن رایگان همیشه فعال و رایگان می‌ماند؛ فقط نام و محدودیت‌هایش قابل تغییر است.');
                return;
            }
        }

        $sets = [];
        $bind = ['id' => $params['id']];
        foreach ($plan as $key => $value) {
            $sets[] = "{$key} = :{$key}";
            $bind[$key] = $value;
        }
        $pdo->prepare('UPDATE trainer_plans SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($bind);

        Response::ok(['ok' => true]);
    }

    // ---- Admin: subscriptions --------------------------------------------

    /** GET /admin/trainer-billing/subscriptions: every trainer account with their subscription. */
    public static function adminSubscriptions(): void
    {
        Auth::requireAdmin('finance.plans');
        if (!TrainerBilling::ready()) {
            Response::ok(['ready' => false, 'items' => []]);
            return;
        }

        $rows = Database::connection()->query(
            "SELECT t.id AS trainer_id, t.first_name, t.last_name, t.phone,
                    s.plan_name, s.max_athletes, s.expires_at,
                    EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = t.id AND m.role = 'trainer' AND m.status = 'active') AS in_club,
                    (SELECT COUNT(*) FROM trainer_athletes ta WHERE ta.trainer_id = t.id AND ta.status = 'active') AS athlete_count
             FROM profiles t LEFT JOIN trainer_subscriptions s ON s.trainer_id = t.id
             WHERE t.account_type = 'trainer'
             ORDER BY s.expires_at IS NULL, s.expires_at ASC, t.created_at DESC LIMIT 1000"
        )->fetchAll();

        foreach ($rows as &$row) {
            $row['status'] = Subscriptions::status($row["expires_at"]);
            $row['remaining_days'] = Subscriptions::remainingDays($row['expires_at']);
        }
        unset($row);

        Response::ok([
            'ready'     => true,
            'enforcing' => Settings::get('billing')['trainer_enforce'],
            'items'     => Cast::rows($rows, [], ['max_athletes', 'athlete_count'], ['in_club']),
        ]);
    }

    /** POST /admin/trainer-billing/subscriptions/{trainerId}/grant {days, plan_id?}: free days, or a plan by hand. */
    public static function grant(array $params): void
    {
        $admin = Auth::requireAdmin('finance.plans');
        if (!self::ready()) {
            return;
        }
        $data = Validate::required(Validate::body(), ['days']);
        $days = filter_var($data['days'], FILTER_VALIDATE_INT);
        if ($days === false || $days < 1 || $days > 3650) {
            Response::error(400, 'invalid_days', 'تعداد روز باید بین ۱ و ۳۶۵۰ باشد.');
            return;
        }

        $pdo = Database::connection();
        $trainer = $pdo->prepare("SELECT id FROM profiles WHERE id = :id AND account_type = 'trainer'");
        $trainer->execute(['id' => $params['trainerId']]);
        if ($trainer->fetchColumn() === false) {
            Response::error(404, 'not_found', 'مربی پیدا نشد.');
            return;
        }

        $planName = 'روز هدیه';
        $cap = null;
        $planId = Validate::nullableString($data['plan_id'] ?? null);
        if ($planId !== null) {
            $plan = $pdo->prepare('SELECT name, max_athletes FROM trainer_plans WHERE id = :id' . self::notFree());
            $plan->execute(['id' => $planId]);
            $plan = $plan->fetch();
            if ($plan === false) {
                Response::error(404, 'plan_not_found', 'پلن پیدا نشد.');
                return;
            }
            $planName = $plan['name'];
            $cap = $plan['max_athletes'] === null ? null : (int) $plan['max_athletes'];
        } else {
            // Free days keep whatever plan the trainer already has; a trainer
            // on the free plan has no period to lengthen.
            $current = TrainerBilling::subscription($pdo, $params['trainerId']);
            if (Limits::ready() && ($current === null || $current['expires_at'] === null)) {
                Response::error(400, 'plan_required', 'این مربی پلن پولی ندارد؛ برای روز هدیه یک پلن انتخاب کنید.');
                return;
            }
            if ($current !== null) {
                $planName = $current['plan_name'];
                $cap = $current['max_athletes'];
            }
        }

        $pdo->beginTransaction();
        try {
            $before = Limits::forTrainer($pdo, $params['trainerId']);
            $expiresAt = TrainerBilling::extend($pdo, $params['trainerId'], $days, $planName, $cap, $planId);
            AdminController::logActivity($pdo, null, $admin['id'], $params['trainerId'], 'trainer_subscription_granted', [
                'days'       => $days,
                'plan'       => $planName,
                'before'     => PlanAccountsController::snapshot($before),
                'expires_at' => $expiresAt,
            ]);
            // A plan brings its tier; free days keep the tier there is.
            if ($planId !== null) {
                Tiers::setTrainerTier($pdo, $params['trainerId'], Tiers::planTier($pdo, 'trainer_plans', $planId));
            }
            Templates::notify(
                $pdo,
                'trainer_subscription_granted',
                $params['trainerId'],
                $admin['id'],
                'broadcast',
                ['date' => Jalali::format($expiresAt, true)],
                '/subscription'
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

    // ---- Helpers ---------------------------------------------------------

    private static function requireTrainer(): array
    {
        $user = Auth::requireUser();
        if ($user['account_type'] !== 'trainer') {
            Response::error(403, 'forbidden', 'این بخش مخصوص مربی‌هاست.');
            exit;
        }
        return $user;
    }

    private static function ready(): bool
    {
        if (TrainerBilling::ready()) {
            return true;
        }
        Response::error(409, 'trainer_billing_unavailable', 'به‌روزرسانی دیتابیس برای اشتراک مربی هنوز اجرا نشده است.');
        return false;
    }

    /**
     * The plan fields in $data, validated; with $all every one is required.
     * Ends the request with 400 and returns null on a bad value.
     *
     * @return array<string, mixed>|null
     */
    private static function planFields(array $data, bool $all): ?array
    {
        $out = [];

        if ($all || array_key_exists('name', $data)) {
            $name = trim((string) ($data['name'] ?? ''));
            if ($name === '' || mb_strlen($name) > 255) {
                Response::error(400, 'invalid_name', 'نام پلن را وارد کنید.');
                return null;
            }
            $out['name'] = $name;
        }
        if ($all || array_key_exists('price_toman', $data)) {
            $price = filter_var($data['price_toman'] ?? null, FILTER_VALIDATE_INT);
            if ($price === false || $price < 0) {
                Response::error(400, 'invalid_price', 'قیمت باید عددی صحیح و نامنفی باشد.');
                return null;
            }
            $out['price_toman'] = $price;
        }
        if ($all || array_key_exists('duration_days', $data)) {
            $days = filter_var($data['duration_days'] ?? null, FILTER_VALIDATE_INT);
            if ($days === false || $days < 1 || $days > 3650) {
                Response::error(400, 'invalid_duration', 'مدت باید بین ۱ و ۳۶۵۰ روز باشد.');
                return null;
            }
            $out['duration_days'] = $days;
        }
        if ($all || array_key_exists('max_athletes', $data)) {
            $cap = $data['max_athletes'] ?? null;
            if ($cap === null || $cap === '') {
                $out['max_athletes'] = null;
            } else {
                $cap = filter_var($cap, FILTER_VALIDATE_INT);
                if ($cap === false || $cap < 1 || $cap > 100000) {
                    Response::error(400, 'invalid_capacity', 'سقف ورزشکار باید عددی مثبت باشد، یا خالی برای بدون محدودیت.');
                    return null;
                }
                $out['max_athletes'] = $cap;
            }
        }
        if (array_key_exists('is_active', $data)) {
            $out['is_active'] = filter_var($data['is_active'], FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
        }
        if (Limits::ready()) {
            $features = PlanAccountsController::featureFields($data);
            if (isset($features['error'])) {
                Response::error(400, $features['error'][0], $features['error'][1]);
                return null;
            }
            $out += $features;
        }

        return $out;
    }

    /** " AND the plan isn't the free one", once the database knows which that is. */
    private static function notFree(): string
    {
        return Limits::ready() ? ' AND is_free = 0' : '';
    }

    private static function text(mixed $value, int $max): ?string
    {
        $text = mb_substr(trim((string) $value), 0, $max);
        return $text === '' ? null : $text;
    }
}
