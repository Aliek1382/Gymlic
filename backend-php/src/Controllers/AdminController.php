<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Acl;
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
use Gymlic\Security;
use Gymlic\Settings;
use Gymlic\SmsGateway;
use Gymlic\Subscriptions;
use Gymlic\Templates;
use Gymlic\TrackingCodes;
use Gymlic\Tiers;
use Gymlic\TrainerBilling;
use Gymlic\TrainerVerification;
use Gymlic\Uuid;
use Gymlic\Validate;
use PDO;
use Throwable;

final class AdminController
{
    // ---- Club-side: filing a payment claim -------------------------------

    /** DELETE /payment-requests/{id}: the club owner takes back a request nobody has answered. */
    public static function cancelPaymentRequest(array $params): void
    {
        $user = Auth::requireUser();
        PaymentCancel::respond(PaymentCancel::own('payment_requests', $params['id'], $user['id']));
    }

    /** submit_payment_request (0023): a club owner files an offline payment. */
    public static function submitPaymentRequest(): void
    {
        $user = Auth::requireUser();
        // Multipart once a receipt is attached; plain JSON from an older page.
        $multipart = str_starts_with(strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? '')), 'multipart/form-data');
        $data = Validate::required($multipart ? $_POST : Validate::body(), ['plan_id', 'amount_toman']);

        $pdo = Database::connection();

        $club = $pdo->prepare('SELECT id, name FROM clubs WHERE owner_id = :owner_id');
        $club->execute(['owner_id' => $user['id']]);
        $clubRow = $club->fetch();

        if ($clubRow === false) {
            Response::error(403, 'forbidden', 'Only a club owner can submit a payment request.');
            return;
        }

        // The free club plan is never bought: it is what a club has without one.
        $plan = $pdo->prepare('SELECT id, name, price_toman FROM plans WHERE id = :id AND is_active = 1' . Limits::notFreeClubPlan());
        $plan->execute(['id' => $data['plan_id']]);
        $planRow = $plan->fetch();
        if ($planRow === false) {
            Response::error(404, 'plan_not_found', 'That plan is not available.');
            return;
        }

        $amount = (int) $data['amount_toman'];
        if ($amount < 0) {
            Response::error(400, 'invalid_amount', 'مبلغ نمی‌تواند منفی باشد.');
            return;
        }

        $code = Discounts::normalizeCode($data['discount_code'] ?? '');
        if ($code !== '' && !Discounts::ready()) {
            Response::error(409, 'discounts_unavailable', 'کد تخفیف فعلاً پذیرفته نمی‌شود.');
            return;
        }

        $id = Uuid::v4();
        $row = [
            'id'             => $id,
            'club_id'        => $clubRow['id'],
            'plan_id'        => (string) $data['plan_id'],
            'submitted_by'   => $user['id'],
            'amount_toman'   => $amount,
            'reference_note' => Validate::nullableString($data['reference_note'] ?? null),
        ];

        // Tracking code, last four card digits and receipt (once the
        // database has the columns; before that the request is as it was).
        $receiptFile = null;
        if (Receipts::ready()) {
            $billing = Settings::get('billing');
            $fields = Receipts::parseFields($data);
            if (isset($fields['error'])) {
                Response::error(400, $fields['error'][0], $fields['error'][1]);
                return;
            }
            $row += $fields['row'];

            $upload = $_FILES['receipt'] ?? null;
            if ($upload !== null && ($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
                $stored = Receipts::store($upload, $billing['receipt_max_mb']);
                if (!$stored['ok']) {
                    Response::error($stored['status'], $stored['code'], $stored['message']);
                    return;
                }
                $receiptFile = $stored['file'];
                $row['receipt_path'] = $receiptFile;
            } elseif ($billing['receipt_required']) {
                Response::error(400, 'receipt_required', 'تصویر یا فایل رسید پرداخت را پیوست کنید.');
                return;
            }
        }

        $pdo->beginTransaction();
        try {
            if ($code !== '') {
                // Checked again here, with the code locked, whatever the
                // dialog showed: it may have run out since.
                $result = Discounts::evaluate($pdo, $code, $planRow, $clubRow['id'], true);
                if (!$result['ok']) {
                    $pdo->rollBack();
                    Receipts::remove($receiptFile);
                    Response::error(409, $result['error'], $result['message']);
                    return;
                }
                $row += [
                    'discount_code_id' => $result['code']['id'],
                    'list_price_toman' => $result['list_price'],
                    'discount_toman'   => $result['discount'],
                ];
            }

            $pdo->prepare(
                'INSERT INTO payment_requests (' . implode(', ', array_keys($row)) . ')
                 VALUES (:' . implode(', :', array_keys($row)) . ')'
            )->execute($row);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            Receipts::remove($receiptFile);
            throw $e;
        }

        self::notifyFinance($pdo, $user['id'], (string) $clubRow['name'], $amount);
        if ($receiptFile !== null) {
            Receipts::purgeIfDue($pdo);
        }

        Response::ok(['id' => $id], 201);
    }

    /** Tells the admins who review payments that a request is waiting. Never throws. */
    private static function notifyFinance(PDO $pdo, string $actorId, string $clubName, int $amount): void
    {
        try {
            foreach (AdminAccess::holders($pdo, 'finance.payments') as $adminId) {
                Templates::notify(
                    $pdo,
                    'payment_submitted',
                    $adminId,
                    $actorId,
                    'broadcast',
                    ['club' => $clubName, 'amount' => number_format($amount)],
                    '/admin/payments'
                );
            }
        } catch (Throwable $e) {
            error_log('payment submitted notice: ' . $e->getMessage());
        }
    }

    /** The plan catalogue, readable by any signed-in user (RLS allowed all). */
    public static function listPlans(): void
    {
        Auth::requireUser();

        $limits = Limits::ready();
        $stmt = Database::connection()->query(
            'SELECT id, name, price_toman, duration_days, max_members, is_active'
            . (Database::hasColumn('plans', 'is_free') ? ', is_free' : '')
            . ($limits ? ', max_trainers, max_custom_exercises, max_templates, history_months, report_level,
                (SELECT COUNT(*) FROM subscriptions s WHERE s.plan_id = plans.id) AS subscriber_count' : '') . '
             FROM plans ORDER BY is_active DESC, price_toman ASC'
        );

        Response::ok([
            'items' => Cast::rows(
                $stmt->fetchAll(),
                [],
                ['price_toman', 'duration_days', 'max_members', 'max_trainers', 'max_custom_exercises', 'max_templates', 'history_months', 'subscriber_count'],
                ['is_active', 'is_free']
            ),
        ]);
    }

    /** A club owner's own requests; a platform admin sees every club's. */
    public static function listPaymentRequests(): void
    {
        $user = Auth::requireUser();
        // A role that reviews payments sees every club's requests, like a super admin.
        $isAdmin = AdminAccess::can($user, 'finance.payments');
        if ($isAdmin) {
            PaymentReminders::sendIfDue(Database::connection());
        }

        $discounts = Discounts::ready();
        $receipts = Receipts::ready();
        $sql =
            'SELECT pr.id, pr.club_id, pr.plan_id, pr.amount_toman, pr.reference_note, pr.status,
                    pr.admin_note, pr.reviewed_at, pr.created_at,
                    c.name AS club_name, p.name AS plan_name,
                    (pr.submitted_by <> c.owner_id) AS recorded_by_admin'
            . ($discounts ? ', pr.list_price_toman, pr.discount_toman, d.code AS discount_code' : '')
            . ($receipts
                ? ', pr.tracking_code, pr.card_last4, pr.paid_at, pr.receipt_purged_at,
                    (pr.receipt_path IS NOT NULL) AS has_receipt,
                    (pr.receipt_path LIKE \'%.pdf\') AS receipt_is_pdf,
                    ' . TrackingCodes::duplicateExpr('payment_requests', 'pr') . ' AS duplicate_tracking'
                : '')
            // The club typed the amount: flag it when it is not what the plan
            // costs (with any discount), unless an admin recorded it by hand.
            . ', (pr.submitted_by = c.owner_id AND pr.amount_toman <> '
            . ($discounts ? 'COALESCE(pr.list_price_toman, p.price_toman) - pr.discount_toman' : 'p.price_toman')
            . ') AS amount_mismatch, p.price_toman AS plan_price_toman
             FROM payment_requests pr
             JOIN clubs c ON c.id = pr.club_id
             JOIN plans p ON p.id = pr.plan_id'
            . ($discounts ? ' LEFT JOIN discount_codes d ON d.id = pr.discount_code_id' : '');
        $bind = [];

        if (!$isAdmin) {
            $sql .= ' WHERE c.owner_id = :owner_id';
            $bind['owner_id'] = $user['id'];
        }
        $sql .= ' ORDER BY pr.created_at DESC';

        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($bind);

        $rows = Cast::rows(
            $stmt->fetchAll(),
            [],
            ['amount_toman', 'list_price_toman', 'discount_toman', 'plan_price_toman'],
            ['recorded_by_admin', 'has_receipt', 'receipt_is_pdf', 'duplicate_tracking', 'amount_mismatch']
        );

        if ($receipts) {
            // When the file goes: the retention days after the review.
            $days = Settings::get('billing')['receipt_retention_days'];
            foreach ($rows as &$row) {
                // Whether another club used the same code is for admins only.
                if (!$isAdmin) {
                    $row['duplicate_tracking'] = false;
                }
                $row['receipt_expires_at'] = ($row['has_receipt'] && $days > 0 && $row['reviewed_at'] !== null)
                    ? date('Y-m-d H:i:s', (int) strtotime($row['reviewed_at']) + $days * 86400)
                    : null;
            }
            unset($row);

            if ($isAdmin) {
                Receipts::purgeIfDue(Database::connection());
            }
        }

        Response::ok(['items' => $rows]);
    }

    // ---- Platform admin --------------------------------------------------

    /**
     * approve_payment_request (0023/0024): extends or starts the club's
     * subscription and copies the plan's member cap onto the club, all in one
     * transaction with the request row locked so a double click can't grant
     * two subscription periods.
     */
    public static function approvePaymentRequest(array $params): void
    {
        $admin = Auth::requireAdmin('finance.payments');
        $data = Validate::body();

        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            $stmt = $pdo->prepare(
                "SELECT pr.*, p.name AS plan_name, p.duration_days, p.max_members
                 FROM payment_requests pr
                 JOIN plans p ON p.id = pr.plan_id
                 WHERE pr.id = :id AND pr.status = 'pending' FOR UPDATE"
            );
            $stmt->execute(['id' => $params['id']]);
            $request = $stmt->fetch();

            if ($request === false) {
                throw new \RuntimeException('request_not_pending');
            }

            // The same plan counts from the current expiry while it is still
            // running, so approving early doesn't cost the club its remaining
            // days; another plan starts today with its full period.
            $before = Limits::forClub($pdo, $request['club_id']);
            $expiresAt = Subscriptions::extend($pdo, $request['club_id'], (int) $request['duration_days'], $request['plan_name'], $request['plan_id']);
            Tiers::setClubTier($pdo, $request['club_id'], Tiers::planTier($pdo, 'plans', $request['plan_id']));

            $pdo->prepare("UPDATE clubs SET member_capacity = :cap, status = 'active' WHERE id = :id")
                ->execute(['cap' => $request['max_members'], 'id' => $request['club_id']]);

            $pdo->prepare(
                "UPDATE payment_requests SET status = 'approved', admin_note = :note,
                        reviewed_by = :admin, reviewed_at = NOW()
                 WHERE id = :id"
            )->execute([
                'note'  => Validate::nullableString($data['admin_note'] ?? null),
                'admin' => $admin['id'],
                'id'    => $params['id'],
            ]);

            self::logActivity($pdo, $request['club_id'], $admin['id'], $request['submitted_by'], 'payment_request_approved', [
                'request_id' => $params['id'],
                'plan'       => $request['plan_name'],
                'amount'     => (int) $request['amount_toman'],
                'before'     => PlanAccountsController::snapshot($before),
                'expires_at' => $expiresAt,
            ]);

            Templates::notify(
                $pdo,
                'payment_approved',
                $request['submitted_by'],
                $admin['id'],
                'broadcast',
                ['date' => Jalali::format($expiresAt, true)],
                '/finance'
            );

            $pdo->commit();
            Response::ok(['ok' => true, 'expires_at' => $expiresAt]);
        } catch (Throwable $e) {
            $pdo->rollBack();

            if ($e->getMessage() === 'request_not_pending') {
                Response::error(409, 'request_not_pending', 'That request is not pending.');
                return;
            }
            throw $e;
        }
    }

    public static function rejectPaymentRequest(array $params): void
    {
        $admin = Auth::requireAdmin('finance.payments');
        $data = Validate::body();
        $pdo = Database::connection();

        $stmt = $pdo->prepare(
            "UPDATE payment_requests SET status = 'rejected', admin_note = :note,
                    reviewed_by = :admin, reviewed_at = NOW()
             WHERE id = :id AND status = 'pending'"
        );
        $stmt->execute([
            'note'  => Validate::nullableString($data['admin_note'] ?? null),
            'admin' => $admin['id'],
            'id'    => $params['id'],
        ]);

        if ($stmt->rowCount() === 0) {
            Response::error(409, 'request_not_pending', 'That request is not pending.');
            return;
        }

        self::logActivity($pdo, null, $admin['id'], null, 'payment_request_rejected', ['request_id' => $params['id']]);

        $request = $pdo->prepare('SELECT submitted_by, admin_note FROM payment_requests WHERE id = :id');
        $request->execute(['id' => $params['id']]);
        $request = $request->fetch();
        if ($request !== false && $request['submitted_by'] !== null) {
            $note = trim((string) ($request['admin_note'] ?? ''));
            Templates::notify(
                $pdo,
                'payment_rejected',
                $request['submitted_by'],
                $admin['id'],
                'broadcast',
                ['reason' => $note !== '' ? $note : 'برای پیگیری با پشتیبانی تماس بگیرید.'],
                '/finance'
            );
        }

        Response::ok(['ok' => true]);
    }

    public static function setClubStatus(array $params): void
    {
        $admin = Auth::requireAdmin('users.manage');
        $data = Validate::required(Validate::body(), ['status']);
        $status = (string) $data['status'];

        if (!in_array($status, ['active', 'suspended', 'pending'], true)) {
            Response::error(400, 'invalid_status', 'status must be active, suspended or pending.');
            return;
        }

        $pdo = Database::connection();
        $club = $pdo->prepare('SELECT name, owner_id FROM clubs WHERE id = :id');
        $club->execute(['id' => $params['id']]);
        $club = $club->fetch();

        $stmt = $pdo->prepare('UPDATE clubs SET status = :status WHERE id = :id');
        $stmt->execute(['status' => $status, 'id' => $params['id']]);

        // rowCount() is 0 both for a missing club and for "already in that status".
        if ($stmt->rowCount() === 0) {
            if ($club === false) {
                Response::error(404, 'not_found', 'Club not found.');
                return;
            }
            Response::ok(['ok' => true]);
            return;
        }

        self::logActivity($pdo, $params['id'], $admin['id'], null, 'club_status_changed', ['status' => $status]);

        if ($club !== false && $status !== 'pending') {
            Templates::notify(
                $pdo,
                $status === 'suspended' ? 'club_suspended' : 'club_activated',
                $club['owner_id'],
                $admin['id'],
                'broadcast',
                ['club' => $club['name']],
                '/dashboard'
            );
        }

        Response::ok(['ok' => true]);
    }

    public static function setProfileSuspended(array $params): void
    {
        $admin = Auth::requireAdmin('users.manage');
        $data = Validate::body();
        $suspended = !empty($data['suspended']);

        if ($suspended && $params['id'] === $admin['id']) {
            Response::error(409, 'self', 'نمی‌توانید حساب خودتان را مسدود کنید.');
            return;
        }
        Security::targetFor($admin, $params['id']);

        $pdo = Database::connection();
        $before = $pdo->prepare('SELECT is_suspended FROM profiles WHERE id = :id');
        $before->execute(['id' => $params['id']]);
        $before = $before->fetch();

        $pdo->prepare('UPDATE profiles SET is_suspended = :suspended WHERE id = :id')
            ->execute(['suspended' => $suspended ? 1 : 0, 'id' => $params['id']]);

        // A suspended account shouldn't keep working from an existing token.
        if ($suspended) {
            $pdo->prepare('DELETE FROM sessions WHERE user_id = :id')->execute(['id' => $params['id']]);
        }

        self::logActivity($pdo, null, $admin['id'], $params['id'], 'profile_suspension_changed', [
            'suspended' => $suspended,
        ]);

        // Only a real change: the push reaches their devices even though the session is gone.
        if ($before !== false && (bool) $before['is_suspended'] !== $suspended) {
            Templates::notify(
                $pdo,
                $suspended ? 'account_suspended' : 'account_activated',
                $params['id'],
                $admin['id'],
                'broadcast',
                [],
                '/login'
            );
        }

        Response::ok(['ok' => true]);
    }

    /**
     * admin_update_profile (0023). account_type and is_platform_admin are
     * deliberately not editable here — that was the privilege-escalation
     * guard in the original function.
     */
    public static function updateProfile(array $params): void
    {
        $admin = Auth::requireAdmin('users.manage');
        $data = Validate::body();
        $target = Security::targetFor($admin, $params['id']);

        $fields = [];
        $bind = ['id' => $params['id']];

        foreach (['first_name', 'last_name', 'email', 'phone', 'birth_date'] as $key) {
            if (array_key_exists($key, $data)) {
                $fields[] = "{$key} = :{$key}";
                $bind[$key] = Validate::nullableString($data[$key] === null ? null : trim((string) $data[$key]));
            }
        }

        if ($fields === []) {
            Response::error(400, 'no_fields', 'Nothing to update.');
            return;
        }

        $pdo = Database::connection();

        if (isset($bind['email'])) {
            $bind['email'] = strtolower($bind['email']);
            if (!Validate::email($bind['email'])) {
                Response::error(400, 'invalid_email', 'ایمیل معتبر نیست.');
                return;
            }
            $taken = $pdo->prepare('SELECT 1 FROM profiles WHERE email = :email AND id <> :id');
            $taken->execute(['email' => $bind['email'], 'id' => $params['id']]);
            if ($taken->fetch() !== false) {
                Response::error(409, 'email_taken', 'این ایمیل برای حساب دیگری ثبت شده است.');
                return;
            }
        } elseif (array_key_exists('email', $bind)) {
            Response::error(400, 'invalid_email', 'ایمیل نمی‌تواند خالی باشد؛ کاربر با آن وارد می‌شود.');
            return;
        }

        // With two-step login on, an admin without a mobile number could no longer sign in.
        if (array_key_exists('phone', $bind) && AdminAccess::isAdminAccount($target)
            && Security::settings()['admin_2fa'] && SmsGateway::normalizePhone((string) $bind['phone']) === null) {
            Response::error(409, 'admin_needs_phone', 'ورود دومرحله‌ای روشن است؛ حساب مدیران باید شمارهٔ موبایل معتبر داشته باشد.');
            return;
        }
        $pdo->prepare('UPDATE profiles SET ' . implode(', ', $fields) . ' WHERE id = :id')->execute($bind);

        self::logActivity($pdo, null, $admin['id'], $params['id'], 'profile_updated', array_keys($bind));

        Response::ok(['ok' => true]);
    }

    public static function createPlan(): void
    {
        Auth::requireAdmin('finance.plans');
        $data = Validate::required(Validate::body(), ['name', 'price_toman', 'duration_days']);

        $id = Uuid::v4();
        $row = [
            'id'            => $id,
            'name'          => (string) $data['name'],
            'price_toman'   => (int) $data['price_toman'],
            'duration_days' => (int) $data['duration_days'],
            'max_members'   => isset($data['max_members']) && $data['max_members'] !== null
                ? (int) $data['max_members'] : null,
            'is_active'     => array_key_exists('is_active', $data) ? (int) (bool) $data['is_active'] : 1,
        ];
        if (Limits::ready()) {
            $extra = self::clubPlanLimits($data);
            if ($extra === null) {
                return;
            }
            $row += $extra;
        }
        Database::connection()->prepare(
            'INSERT INTO plans (' . implode(', ', array_keys($row)) . ') VALUES (:' . implode(', :', array_keys($row)) . ')'
        )->execute($row);

        Response::ok(['id' => $id], 201);
    }

    public static function updatePlan(array $params): void
    {
        Auth::requireAdmin('finance.plans');
        $data = Validate::body();

        $fields = [];
        $bind = ['id' => $params['id']];

        foreach (['name', 'price_toman', 'duration_days', 'max_members', 'is_active'] as $key) {
            if (array_key_exists($key, $data)) {
                $fields[] = "{$key} = :{$key}";
                $bind[$key] = $data[$key];
            }
        }
        if (Limits::ready()) {
            $extra = self::clubPlanLimits($data);
            if ($extra === null) {
                return;
            }
            foreach ($extra as $key => $value) {
                $fields[] = "{$key} = :{$key}";
                $bind[$key] = $value;
            }
        }

        if ($fields === []) {
            Response::error(400, 'no_fields', 'Nothing to update.');
            return;
        }

        // The free club plan is every unpaid club's: always on, always free.
        if ($params['id'] === Limits::FREE_CLUB_PLAN_ID
            && ((array_key_exists('is_active', $data) && !$data['is_active'])
                || (array_key_exists('price_toman', $data) && (int) $data['price_toman'] !== 0))) {
            Response::error(409, 'free_plan_locked', 'پلن رایگان باشگاه همیشه فعال و رایگان می‌ماند؛ فقط نام و محدودیت‌هایش قابل تغییر است.');
            return;
        }

        Database::connection()
            ->prepare('UPDATE plans SET ' . implode(', ', $fields) . ' WHERE id = :id')
            ->execute($bind);

        Response::ok(['ok' => true]);
    }

    /**
     * A club plan's trainer cap and later-phase limits from the form (only
     * the keys sent). Ends the request with 400 and returns null on a bad value.
     *
     * @return array<string, mixed>|null
     */
    private static function clubPlanLimits(array $data): ?array
    {
        $out = [];
        if (array_key_exists('max_trainers', $data)) {
            $cap = $data['max_trainers'];
            if ($cap === null || $cap === '') {
                $out['max_trainers'] = null;
            } else {
                $cap = filter_var($cap, FILTER_VALIDATE_INT);
                if ($cap === false || $cap < 0 || $cap > 100000) {
                    Response::error(400, 'invalid_capacity', 'سقف مربی باید عددی نامنفی باشد، یا خالی برای بدون محدودیت.');
                    return null;
                }
                $out['max_trainers'] = $cap;
            }
        }
        $features = PlanAccountsController::featureFields($data);
        if (isset($features['error'])) {
            Response::error(400, $features['error'][0], $features['error'][1]);
            return null;
        }
        return $out + $features;
    }

    /** The counters and subscription breakdown on the admin landing page. */
    public static function overview(): void
    {
        $admin = Auth::requireAdmin();
        $pdo = Database::connection();

        $counts = $pdo->query(
            "SELECT
               (SELECT COUNT(*) FROM clubs) AS clubs_count,
               (SELECT COUNT(*) FROM clubs WHERE status = 'pending') AS pending_clubs_count,
               (SELECT COUNT(*) FROM profiles WHERE account_type = 'trainer') AS trainers_count,
               (SELECT COUNT(*) FROM profiles WHERE account_type = 'athlete') AS athletes_count,
               (SELECT COUNT(*) FROM payment_requests WHERE status = 'pending') AS pending_requests_count,
               (SELECT COALESCE(SUM(amount_toman), 0) FROM payment_requests
                 WHERE status = 'approved') AS total_revenue"
        )->fetch();

        // Trainers' subscription payments count with the clubs': the same
        // revenue figure as the finance report, and the same waiting queue.
        if (TrainerBilling::ready()) {
            $trainerPayments = $pdo->query(
                "SELECT COALESCE(SUM(CASE WHEN status = 'approved' THEN amount_toman END), 0) AS revenue,
                        COALESCE(SUM(status = 'pending'), 0) AS pending
                 FROM trainer_payment_requests"
            )->fetch();
            $counts['total_revenue'] = (int) $counts['total_revenue'] + (int) $trainerPayments['revenue'];
            $counts['pending_requests_count'] = (int) $counts['pending_requests_count'] + (int) $trainerPayments['pending'];
        }

        // Counted from the expiry dates: the stored status column is never
        // moved on as time passes (see Subscriptions).
        $counts += ['active_subs' => 0, 'expiring_subs' => 0, 'grace_subs' => 0, 'expired_subs' => 0];
        foreach ($pdo->query('SELECT expires_at FROM subscriptions')->fetchAll(PDO::FETCH_COLUMN) as $expiresAt) {
            $counts[Subscriptions::status((string) $expiresAt) . '_subs']++;
        }

        // Tickets waiting on support, for whoever answers them.
        if (AdminAccess::can($admin, 'support')) {
            $open = SupportController::openCount($pdo);
            if ($open !== null) {
                $counts['open_support_tickets'] = $open;
            }
        }

        // Money is the finance permissions': waiting payments for those who
        // review them, revenue for those who see the reports.
        if (!AdminAccess::can($admin, 'finance.payments')) {
            unset($counts['pending_requests_count']);
        }
        if (!AdminAccess::can($admin, 'finance.reports')) {
            unset($counts['total_revenue']);
        }

        Response::ok(Cast::row($counts, [], array_keys($counts)));
    }

    public static function listClubs(): void
    {
        Auth::requireAdmin('users.view');
        Response::ok(['items' => self::clubRows()]);
    }

    /**
     * Every club with its owner, member count and subscription — the clubs
     * page, the subscriptions page and their CSV exports.
     *
     * @return array<int, array<string, mixed>>
     */
    public static function clubRows(): array
    {
        $stmt = Database::connection()->query(
            "SELECT c.id, c.name, c.status, c.member_capacity, c.created_at,
                    c.owner_id, p.first_name AS owner_first_name, p.last_name AS owner_last_name,
                    p.phone AS owner_phone, p.email AS owner_email,
                    s.plan_name, s.status AS subscription_status,
                    s.started_at AS subscription_started_at, s.expires_at AS subscription_expires_at,
                    (SELECT COUNT(*) FROM memberships m
                      WHERE m.club_id = c.id AND m.role = 'athlete' AND m.status = 'active') AS member_count
             FROM clubs c
             JOIN profiles p ON p.id = c.owner_id
             LEFT JOIN subscriptions s ON s.club_id = c.id
             ORDER BY c.created_at DESC"
        );

        return self::withSubscription(Cast::rows($stmt->fetchAll(), [], ['member_capacity', 'member_count']));
    }

    /** One club's whole file: the club, its active members, and its payment history. */
    public static function clubDetail(array $params): void
    {
        $admin = Auth::requireAdmin('users.view');
        $pdo = Database::connection();

        $stmt = $pdo->prepare(
            "SELECT c.id, c.name, c.status, c.member_capacity, c.created_at,
                    p.first_name AS owner_first_name, p.last_name AS owner_last_name,
                    p.phone AS owner_phone, p.email AS owner_email,
                    s.plan_name, s.status AS subscription_status,
                    s.started_at AS subscription_started_at, s.expires_at AS subscription_expires_at
             FROM clubs c
             JOIN profiles p ON p.id = c.owner_id
             LEFT JOIN subscriptions s ON s.club_id = c.id
             WHERE c.id = :id"
        );
        $stmt->execute(['id' => $params['id']]);
        $club = $stmt->fetch();

        if ($club === false) {
            Response::error(404, 'not_found', 'Club not found.');
            return;
        }

        $members = $pdo->prepare(
            "SELECT m.role, m.joined_at, p.first_name, p.last_name, p.phone
             FROM memberships m
             JOIN profiles p ON p.id = m.user_id
             WHERE m.club_id = :club_id AND m.status = 'active'
             ORDER BY m.joined_at DESC"
        );
        $members->execute(['club_id' => $params['id']]);

        $receipts = Receipts::ready() && AdminAccess::can($admin, 'finance.payments');
        $requests = $pdo->prepare(
            'SELECT pr.id, pr.amount_toman, pr.reference_note, pr.status, pr.admin_note,
                    pr.created_at, pr.reviewed_at, p.name AS plan_name,
                    (pr.submitted_by <> c.owner_id) AS recorded_by_admin'
            . (Discounts::ready() ? ', pr.discount_toman, d.code AS discount_code' : '')
            // The receipt, for an admin who reviews payments (on the club's page as in /admin/payments).
            . ($receipts ? ', pr.tracking_code, pr.card_last4, pr.paid_at, pr.receipt_purged_at,
                (pr.receipt_path IS NOT NULL) AS has_receipt, (pr.receipt_path LIKE \'%.pdf\') AS receipt_is_pdf' : '') . '
             FROM payment_requests pr
             JOIN plans p ON p.id = pr.plan_id
             JOIN clubs c ON c.id = pr.club_id'
            . (Discounts::ready() ? ' LEFT JOIN discount_codes d ON d.id = pr.discount_code_id' : '') . '
             WHERE pr.club_id = :club_id
             ORDER BY pr.created_at DESC'
        );
        $requests->execute(['club_id' => $params['id']]);
        $rows = Cast::rows($requests->fetchAll(), [], ['amount_toman', 'discount_toman'], ['recorded_by_admin', 'has_receipt', 'receipt_is_pdf']);
        if ($receipts) {
            $days = Settings::get('billing')['receipt_retention_days'];
            foreach ($rows as &$row) {
                $row['receipt_expires_at'] = ($row['has_receipt'] && $days > 0 && $row['reviewed_at'] !== null)
                    ? date('Y-m-d H:i:s', (int) strtotime($row['reviewed_at']) + $days * 86400)
                    : null;
            }
            unset($row);
        }

        Response::ok([
            'club'             => self::withSubscription([Cast::row($club, [], ['member_capacity'])])[0],
            'members'          => $members->fetchAll(),
            'payment_requests' => $rows,
        ]);
    }

    /**
     * The people listings. Athletes carry their trainer's name and trainers
     * their athlete count and club, which the admin pages used to assemble
     * from a second query plus client-side tallying.
     */
    public static function listProfiles(): void
    {
        Auth::requireAdmin('users.view');

        $type = $_GET['account_type'] ?? null;
        $extra = '';

        if ($type === 'athlete') {
            $extra = ", (SELECT CONCAT_WS(' ', t.first_name, t.last_name)
                          FROM trainer_athletes ta
                          JOIN profiles t ON t.id = ta.trainer_id
                          WHERE ta.athlete_id = profiles.id AND ta.status = 'active'
                          ORDER BY ta.created_at ASC LIMIT 1) AS trainer_name";
        } elseif ($type === 'trainer') {
            $extra = ", (SELECT COUNT(*) FROM trainer_athletes ta
                          WHERE ta.trainer_id = profiles.id AND ta.status = 'active') AS athlete_count,
                        (SELECT c.name FROM memberships m
                          JOIN clubs c ON c.id = m.club_id
                          WHERE m.user_id = profiles.id AND m.role = 'trainer' AND m.status = 'active'
                          ORDER BY m.joined_at ASC LIMIT 1) AS club_name,
                        " . TrainerVerification::flagSql('profiles.id') . ' AS is_verified';
        }

        $sql = 'SELECT id, first_name, last_name, email, phone, account_type, birth_date,
                       avatar_url, is_suspended, is_platform_admin, created_at' . $extra . '
                FROM profiles';
        $bind = [];

        if ($type !== null && $type !== '') {
            $sql .= ' WHERE account_type = :account_type';
            $bind['account_type'] = $type;
        }
        $sql .= ' ORDER BY created_at DESC';

        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($bind);

        Response::ok([
            'items' => Cast::rows(
                $stmt->fetchAll(),
                [],
                $type === 'trainer' ? ['athlete_count'] : [],
                $type === 'trainer' ? ['is_suspended', 'is_platform_admin', 'is_verified'] : ['is_suspended', 'is_platform_admin']
            ),
        ]);
    }

    /** One trainer's file: their profile, their club, and their athletes. */
    public static function trainerDetail(array $params): void
    {
        Auth::requireAdmin('users.view');
        $pdo = Database::connection();

        $stmt = $pdo->prepare(
            "SELECT p.id, p.first_name, p.last_name, p.phone, p.email, p.birth_date,
                    p.avatar_url, p.is_suspended, p.account_type, p.created_at,
                    (SELECT c.name FROM memberships m
                      JOIN clubs c ON c.id = m.club_id
                      WHERE m.user_id = p.id AND m.role = 'trainer' AND m.status = 'active'
                      ORDER BY m.joined_at ASC LIMIT 1) AS club_name
             FROM profiles p WHERE p.id = :id"
        );
        $stmt->execute(['id' => $params['id']]);
        $trainer = $stmt->fetch();

        if ($trainer === false) {
            Response::error(404, 'not_found', 'Trainer not found.');
            return;
        }

        $students = $pdo->prepare(
            "SELECT ta.status, ta.created_at, p.first_name, p.last_name, p.phone
             FROM trainer_athletes ta
             JOIN profiles p ON p.id = ta.athlete_id
             WHERE ta.trainer_id = :id AND ta.status = 'active'
             ORDER BY ta.created_at DESC"
        );
        $students->execute(['id' => $params['id']]);

        Response::ok([
            'trainer'  => Cast::row($trainer, [], [], ['is_suspended']),
            'students' => $students->fetchAll(),
        ]);
    }

    /** Club names for the broadcast form's audience picker. */
    public static function listClubOptions(): void
    {
        Auth::requireAdmin(['users.view', 'notifications']);

        $stmt = Database::connection()->query('SELECT id, name FROM clubs ORDER BY name ASC');

        Response::ok(['items' => $stmt->fetchAll()]);
    }

    public static function listActivity(): void
    {
        Auth::requireAdmin('activity');

        $stmt = Database::connection()->query(
            'SELECT a.id, a.club_id, a.actor_id, a.subject_id, a.action, a.metadata, a.created_at,
                    c.name AS club_name,
                    s.first_name AS subject_first_name, s.last_name AS subject_last_name
             FROM activity_logs a
             LEFT JOIN clubs c ON c.id = a.club_id
             LEFT JOIN profiles s ON s.id = a.subject_id
             ORDER BY a.created_at DESC LIMIT 100'
        );

        Response::ok(['items' => Cast::json($stmt->fetchAll())]);
    }

    /**
     * subscription_status from the expiry date (see Subscriptions), plus the
     * days left, on club rows that carry subscription_expires_at.
     *
     * @param array<int, array<string, mixed>> $rows
     * @return array<int, array<string, mixed>>
     */
    public static function withSubscription(array $rows): array
    {
        foreach ($rows as &$row) {
            $row['subscription_status'] = Subscriptions::status($row['subscription_expires_at'] ?? null);
            $row['subscription_remaining_days'] = Subscriptions::remainingDays($row['subscription_expires_at'] ?? null);
        }
        unset($row);
        return $rows;
    }

    public static function logActivity(
        PDO $pdo,
        ?string $clubId,
        string $actorId,
        ?string $subjectId,
        string $action,
        array $metadata
    ): void {
        $pdo->prepare(
            'INSERT INTO activity_logs (id, club_id, actor_id, subject_id, action, metadata)
             VALUES (:id, :club_id, :actor_id, :subject_id, :action, :metadata)'
        )->execute([
            'id'         => Uuid::v4(),
            'club_id'    => $clubId,
            'actor_id'   => $actorId,
            'subject_id' => $subjectId,
            'action'     => $action,
            'metadata'   => json_encode($metadata, JSON_UNESCAPED_UNICODE),
        ]);
    }
}
