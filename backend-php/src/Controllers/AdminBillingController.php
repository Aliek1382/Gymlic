<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Auth;
use Gymlic\Cast;
use Gymlic\Database;
use Gymlic\Discounts;
use Gymlic\Jalali;
use Gymlic\Response;
use Gymlic\Subscriptions;
use Gymlic\Uuid;
use Gymlic\Validate;
use PDO;
use Throwable;

/**
 * The finance pages beyond approving payment requests: changing a club's
 * subscription by hand, and the discount codes clubs can pay with.
 * Everything here needs the finance permission.
 */
final class AdminBillingController
{
    private const MAX_GIFT_DAYS = 3650;

    // ---- Subscriptions -----------------------------------------------------

    public static function subscriptions(): void
    {
        Auth::requireAdmin('finance');
        $plans = Database::connection()->query(
            'SELECT id, name, price_toman, duration_days, max_members, is_active FROM plans ORDER BY price_toman ASC'
        )->fetchAll();

        Response::ok([
            'items' => AdminController::clubRows(),
            'plans' => Cast::rows($plans, [], ['price_toman', 'duration_days', 'max_members'], ['is_active']),
        ]);
    }

    /**
     * One club, one of three changes:
     *   renew — a plan's period (and its member cap), as if a payment for it
     *           had been approved; with an amount, that payment is recorded
     *           too, so the finance report includes money received outside
     *           the site.
     *   gift  — N extra days, no money.
     *   set   — the expiry date, plan name and member cap exactly as given
     *           (a past date ends the subscription).
     */
    public static function updateSubscription(array $params): void
    {
        $admin = Auth::requireAdmin('finance');
        $data = Validate::required(Validate::body(), ['action']);
        $pdo = Database::connection();

        $club = $pdo->prepare('SELECT id, name, owner_id, status FROM clubs WHERE id = :id');
        $club->execute(['id' => $params['id']]);
        $club = $club->fetch();
        if ($club === false) {
            Response::error(404, 'not_found', 'باشگاه پیدا نشد.');
            return;
        }

        $note = Validate::nullableString(trim((string) ($data['note'] ?? '')));
        $notify = !array_key_exists('notify', $data) || !empty($data['notify']);

        $pdo->beginTransaction();
        try {
            switch ((string) $data['action']) {
                case 'renew':
                    $outcome = self::renew($pdo, $club, $data, $note, $admin['id']);
                    break;
                case 'gift':
                    $outcome = self::gift($pdo, $club, $data, $note);
                    break;
                case 'set':
                    $outcome = self::set($pdo, $club, $data);
                    break;
                default:
                    $outcome = ['error' => [400, 'invalid_action', 'action must be renew, gift or set.']];
            }

            if (isset($outcome['error'])) {
                $pdo->rollBack();
                Response::error(...$outcome['error']);
                return;
            }

            AdminController::logActivity($pdo, $club['id'], $admin['id'], $club['owner_id'], $outcome['action'], $outcome['log'] + [
                'club' => $club['name'],
                'note' => $note,
            ]);

            if ($notify) {
                AuthController::notify($pdo, $club['owner_id'], $admin['id'], 'broadcast', $outcome['title'], $outcome['body'], '/finance');
            }

            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        $row = array_values(array_filter(AdminController::clubRows(), static fn (array $r): bool => $r['id'] === $club['id']));
        Response::ok(['club' => $row[0] ?? null]);
    }

    /** @return array<string, mixed> */
    private static function renew(PDO $pdo, array $club, array $data, ?string $note, string $adminId): array
    {
        $plan = $pdo->prepare('SELECT id, name, duration_days, max_members FROM plans WHERE id = :id');
        $plan->execute(['id' => (string) ($data['plan_id'] ?? '')]);
        $plan = $plan->fetch();
        if ($plan === false) {
            return ['error' => [404, 'plan_not_found', 'پلن انتخاب‌شده پیدا نشد.']];
        }

        $amount = $data['amount_toman'] ?? 0;
        if ($amount === '' || $amount === null) {
            $amount = 0;
        }
        if (!is_numeric($amount) || (int) $amount < 0 || (int) $amount > 1_000_000_000_000) {
            return ['error' => [400, 'invalid_amount', 'مبلغ دریافتی معتبر نیست.']];
        }
        $amount = (int) $amount;

        $expiresAt = Subscriptions::extend($pdo, $club['id'], (int) $plan['duration_days'], $plan['name']);

        // The plan's member cap, as approving a payment for it would. A
        // suspended club stays suspended: that was a separate decision.
        $pdo->prepare(
            "UPDATE clubs SET member_capacity = :cap,
                    status = CASE WHEN status = 'pending' THEN 'active' ELSE status END
             WHERE id = :id"
        )->execute(['cap' => $plan['max_members'], 'id' => $club['id']]);

        $requestId = null;
        if ($amount > 0) {
            $requestId = Uuid::v4();
            $pdo->prepare(
                "INSERT INTO payment_requests
                   (id, club_id, plan_id, submitted_by, amount_toman, reference_note, status, admin_note, reviewed_by, reviewed_at)
                 VALUES (:id, :club_id, :plan_id, :submitted_by, :amount, :reference_note, 'approved', :admin_note, :reviewed_by, NOW())"
            )->execute([
                'id'             => $requestId,
                'club_id'        => $club['id'],
                'plan_id'        => $plan['id'],
                'submitted_by'   => $adminId,
                'amount'         => $amount,
                'reference_note' => 'ثبت دستی در پنل مدیریت',
                'admin_note'     => $note,
                'reviewed_by'    => $adminId,
            ]);
        }

        return [
            'action' => 'subscription_renewed',
            'log'    => ['plan' => $plan['name'], 'days' => (int) $plan['duration_days'], 'amount' => $amount, 'expires_at' => $expiresAt, 'request_id' => $requestId],
            'title'  => 'اشتراک باشگاه تمدید شد',
            'body'   => 'اشتراک «' . $plan['name'] . '» باشگاه شما تا ' . Jalali::format($expiresAt, true) . ' تمدید شد.',
        ];
    }

    /** @return array<string, mixed> */
    private static function gift(PDO $pdo, array $club, array $data, ?string $note): array
    {
        $days = self::giftDays($data['days'] ?? null);
        if ($days === null) {
            return ['error' => [400, 'invalid_days', 'تعداد روز باید بین ۱ و ۳۶۵۰ باشد.']];
        }

        $hadOne = Subscriptions::latest($pdo, $club['id']) !== null;
        $expiresAt = Subscriptions::extend($pdo, $club['id'], $days, $hadOne ? null : 'اشتراک هدیه');

        return [
            'action' => 'subscription_gifted',
            'log'    => ['days' => $days, 'expires_at' => $expiresAt],
            'title'  => 'روز هدیه به اشتراک شما اضافه شد',
            'body'   => self::persianNumber($days) . ' روز هدیه به اشتراک باشگاه شما اضافه شد؛ اشتراک تا '
                . Jalali::format($expiresAt, true) . ' فعال است.' . ($note !== null ? ' ' . $note : ''),
        ];
    }

    /** @return array<string, mixed> */
    private static function set(PDO $pdo, array $club, array $data): array
    {
        $date = (string) ($data['expires_at'] ?? '');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || strtotime($date) === false) {
            return ['error' => [400, 'invalid_date', 'تاریخ انقضا معتبر نیست.']];
        }
        $planName = trim((string) ($data['plan_name'] ?? ''));
        if ($planName === '' || mb_strlen($planName) > 255) {
            return ['error' => [400, 'invalid_plan_name', 'نام پلن را وارد کنید.']];
        }

        $capacity = $data['member_capacity'] ?? null;
        if ($capacity === '' || $capacity === null) {
            $capacity = null;
        } elseif (!is_numeric($capacity) || (int) $capacity < 1 || (int) $capacity > 1_000_000) {
            return ['error' => [400, 'invalid_capacity', 'ظرفیت عضو باید عددی مثبت باشد، یا خالی برای بدون محدودیت.']];
        } else {
            $capacity = (int) $capacity;
        }

        // The end of the chosen day, so "until 1405/07/30" includes the 30th.
        $expiresAt = $date . ' 23:59:59';
        Subscriptions::set($pdo, $club['id'], $planName, $expiresAt);
        $pdo->prepare('UPDATE clubs SET member_capacity = :cap WHERE id = :id')
            ->execute(['cap' => $capacity, 'id' => $club['id']]);

        $ended = strtotime($expiresAt) <= time();

        return [
            'action' => 'subscription_set',
            'log'    => ['plan' => $planName, 'expires_at' => $expiresAt, 'member_capacity' => $capacity],
            'title'  => $ended ? 'اشتراک باشگاه پایان یافت' : 'اشتراک باشگاه به‌روزرسانی شد',
            'body'   => $ended
                ? 'اشتراک باشگاه شما پایان یافت. برای تمدید از بخش «امور مالی» اقدام کنید.'
                : 'اشتراک «' . $planName . '» باشگاه شما تا ' . Jalali::format($expiresAt, true) . ' فعال است.',
        ];
    }

    /**
     * Extra days for every club whose subscription is still running (or,
     * with include_expired, every club that has one) — e.g. to make up for
     * a day the site was down.
     */
    public static function giftAll(): void
    {
        $admin = Auth::requireAdmin('finance');
        $data = Validate::body();
        $days = self::giftDays($data['days'] ?? null);
        if ($days === null) {
            Response::error(400, 'invalid_days', 'تعداد روز باید بین ۱ و ۳۶۵۰ باشد.');
            return;
        }
        $includeExpired = !empty($data['include_expired']);
        $notify = !array_key_exists('notify', $data) || !empty($data['notify']);
        $note = Validate::nullableString(trim((string) ($data['note'] ?? '')));

        $pdo = Database::connection();
        $clubs = $pdo->query(
            'SELECT c.id, c.owner_id, MAX(s.expires_at) AS expires_at
             FROM clubs c JOIN subscriptions s ON s.club_id = c.id
             GROUP BY c.id, c.owner_id'
        )->fetchAll();

        $count = 0;
        $pdo->beginTransaction();
        try {
            foreach ($clubs as $club) {
                if (!$includeExpired && strtotime((string) $club['expires_at']) <= time()) {
                    continue;
                }
                $expiresAt = Subscriptions::extend($pdo, $club['id'], $days, null);
                $count++;

                if ($notify) {
                    AuthController::notify(
                        $pdo,
                        $club['owner_id'],
                        $admin['id'],
                        'broadcast',
                        'روز هدیه به اشتراک شما اضافه شد',
                        self::persianNumber($days) . ' روز هدیه به اشتراک باشگاه شما اضافه شد؛ اشتراک تا '
                            . Jalali::format($expiresAt, true) . ' فعال است.' . ($note !== null ? ' ' . $note : ''),
                        '/finance'
                    );
                }
            }

            AdminController::logActivity($pdo, null, $admin['id'], null, 'subscriptions_gifted', [
                'days'             => $days,
                'count'            => $count,
                'include_expired'  => $includeExpired,
                'note'             => $note,
            ]);
            $pdo->commit();
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }

        Response::ok(['count' => $count]);
    }

    private static function giftDays(mixed $value): ?int
    {
        if (!is_numeric($value)) {
            return null;
        }
        $days = (int) $value;
        return ($days >= 1 && $days <= self::MAX_GIFT_DAYS) ? $days : null;
    }

    private static function persianNumber(int $n): string
    {
        return strtr((string) $n, ['0' => '۰', '1' => '۱', '2' => '۲', '3' => '۳', '4' => '۴', '5' => '۵', '6' => '۶', '7' => '۷', '8' => '۸', '9' => '۹']);
    }

    // ---- Revenue report ----------------------------------------------------

    public static function revenue(): void
    {
        Auth::requireAdmin('finance');
        Response::ok(self::revenueSummary());
    }

    /**
     * Approved payments, by the Jalali month they were approved in (when the
     * money counts as received) and by plan. The reports page and its CSV
     * both come from here, so they always agree.
     *
     * @return array{total: int, count: int, discount_total: int, months: list<array>, plans: list<array>}
     */
    public static function revenueSummary(): array
    {
        $discounts = Discounts::ready();
        $rows = Database::connection()->query(
            "SELECT COALESCE(pr.reviewed_at, pr.created_at) AS paid_at, pr.amount_toman, p.name AS plan_name"
            . ($discounts ? ', pr.discount_toman' : ', 0 AS discount_toman') . "
             FROM payment_requests pr
             JOIN plans p ON p.id = pr.plan_id
             WHERE pr.status = 'approved'"
        )->fetchAll();

        $months = [];
        $plans = [];
        $total = 0;
        $discountTotal = 0;
        foreach ($rows as $r) {
            $amount = (int) $r['amount_toman'];
            $discount = (int) $r['discount_toman'];
            $total += $amount;
            $discountTotal += $discount;

            $key = substr(Jalali::format($r['paid_at']), 0, 7);
            $months[$key] ??= ['month' => $key, 'count' => 0, 'total' => 0, 'discount' => 0];
            $months[$key]['count']++;
            $months[$key]['total'] += $amount;
            $months[$key]['discount'] += $discount;

            $plans[$r['plan_name']] ??= ['plan_name' => $r['plan_name'], 'count' => 0, 'total' => 0];
            $plans[$r['plan_name']]['count']++;
            $plans[$r['plan_name']]['total'] += $amount;
        }
        krsort($months);
        usort($plans, static fn (array $a, array $b): int => $b['total'] <=> $a['total']);

        return [
            'total'          => $total,
            'count'          => count($rows),
            'discount_total' => $discountTotal,
            'months'         => array_values($months),
            'plans'          => array_values($plans),
        ];
    }

    // ---- Discount codes ----------------------------------------------------

    public static function listDiscounts(): void
    {
        Auth::requireAdmin('finance');
        $pdo = Database::connection();
        $plans = Cast::rows(
            $pdo->query('SELECT id, name, price_toman, is_active FROM plans ORDER BY price_toman ASC')->fetchAll(),
            [],
            ['price_toman'],
            ['is_active']
        );

        if (!Discounts::ready()) {
            Response::ok(['ready' => false, 'items' => [], 'plans' => $plans]);
            return;
        }

        $rows = $pdo->query(
            "SELECT d.id, d.code, d.kind, d.value, d.plan_id, p.name AS plan_name, d.max_uses,
                    d.once_per_club, d.expires_at, d.is_active, d.note, d.created_at,
                    (SELECT COUNT(*) FROM payment_requests pr
                      WHERE pr.discount_code_id = d.id AND pr.status IN ('pending', 'approved')) AS uses,
                    (SELECT COALESCE(SUM(pr.discount_toman), 0) FROM payment_requests pr
                      WHERE pr.discount_code_id = d.id AND pr.status = 'approved') AS total_discount
             FROM discount_codes d
             LEFT JOIN plans p ON p.id = d.plan_id
             ORDER BY d.created_at DESC"
        )->fetchAll();

        Response::ok([
            'ready' => true,
            'items' => Cast::rows($rows, [], ['value', 'max_uses', 'uses', 'total_discount'], ['once_per_club', 'is_active']),
            'plans' => $plans,
        ]);
    }

    public static function createDiscount(): void
    {
        $admin = Auth::requireAdmin('finance');
        if (!self::discountsReady()) {
            return;
        }
        $pdo = Database::connection();
        $fields = self::discountFields($pdo, Validate::body(), null);
        if ($fields === null) {
            return;
        }

        $id = Uuid::v4();
        $fields += ['id' => $id, 'created_by' => $admin['id']];
        $pdo->prepare(
            'INSERT INTO discount_codes (' . implode(', ', array_keys($fields)) . ')
             VALUES (:' . implode(', :', array_keys($fields)) . ')'
        )->execute($fields);

        AdminController::logActivity($pdo, null, $admin['id'], null, 'discount_code_saved', ['code' => $fields['code']]);
        Response::ok(['id' => $id], 201);
    }

    public static function updateDiscount(array $params): void
    {
        $admin = Auth::requireAdmin('finance');
        if (!self::discountsReady()) {
            return;
        }
        $pdo = Database::connection();
        $existing = $pdo->prepare('SELECT id FROM discount_codes WHERE id = :id');
        $existing->execute(['id' => $params['id']]);
        if ($existing->fetch() === false) {
            Response::error(404, 'not_found', 'کد تخفیف پیدا نشد.');
            return;
        }

        $fields = self::discountFields($pdo, Validate::body(), $params['id']);
        if ($fields === null) {
            return;
        }

        $set = implode(', ', array_map(static fn (string $k): string => "{$k} = :{$k}", array_keys($fields)));
        $pdo->prepare("UPDATE discount_codes SET {$set} WHERE id = :id")->execute($fields + ['id' => $params['id']]);

        AdminController::logActivity($pdo, null, $admin['id'], null, 'discount_code_saved', ['code' => $fields['code']]);
        Response::ok(['ok' => true]);
    }

    public static function deleteDiscount(array $params): void
    {
        $admin = Auth::requireAdmin('finance');
        if (!self::discountsReady()) {
            return;
        }
        $pdo = Database::connection();
        $code = $pdo->prepare('SELECT code FROM discount_codes WHERE id = :id');
        $code->execute(['id' => $params['id']]);
        $code = $code->fetchColumn();
        if ($code === false) {
            Response::error(404, 'not_found', 'کد تخفیف پیدا نشد.');
            return;
        }

        // A code on a payment request is part of that payment's record.
        $used = $pdo->prepare('SELECT 1 FROM payment_requests WHERE discount_code_id = :id LIMIT 1');
        $used->execute(['id' => $params['id']]);
        if ($used->fetch() !== false) {
            Response::error(409, 'code_in_use', 'این کد در درخواست‌های پرداخت استفاده شده و سابقه‌اش باید بماند؛ به‌جای حذف، غیرفعالش کنید.');
            return;
        }

        $pdo->prepare('DELETE FROM discount_codes WHERE id = :id')->execute(['id' => $params['id']]);
        AdminController::logActivity($pdo, null, $admin['id'], null, 'discount_code_deleted', ['code' => $code]);
        Response::ok(['ok' => true]);
    }

    private static function discountsReady(): bool
    {
        if (Discounts::ready()) {
            return true;
        }
        Response::error(503, 'discounts_not_ready', 'کد تخفیف هنوز فعال نیست. به‌روزرسانی «کد تخفیف اشتراک (فاز ۶)» را از صفحهٔ «به‌روزرسانی دیتابیس» اجرا کنید.');
        return false;
    }

    /**
     * The validated columns of a discount code, or null after answering 400/409.
     *
     * @return array<string, mixed>|null
     */
    private static function discountFields(PDO $pdo, array $data, ?string $id): ?array
    {
        $code = Discounts::normalizeCode($data['code'] ?? '');
        if (!Discounts::validCodeFormat($code)) {
            Response::error(400, 'invalid_code', 'کد باید ۳ تا ۴۰ حرف انگلیسی، عدد، - یا _ باشد.');
            return null;
        }
        $taken = $pdo->prepare('SELECT 1 FROM discount_codes WHERE code = :code AND id <> :id');
        $taken->execute(['code' => $code, 'id' => $id ?? '']);
        if ($taken->fetch() !== false) {
            Response::error(409, 'code_taken', 'کد تخفیفی با همین متن وجود دارد.');
            return null;
        }

        $kind = $data['kind'] ?? '';
        if (!in_array($kind, ['percent', 'amount'], true)) {
            Response::error(400, 'invalid_kind', 'نوع تخفیف باید درصدی یا مبلغی باشد.');
            return null;
        }
        $value = $data['value'] ?? null;
        $max = $kind === 'percent' ? 100 : 1_000_000_000_000;
        if (!is_numeric($value) || (int) $value < 1 || (int) $value > $max) {
            Response::error(400, 'invalid_value', $kind === 'percent' ? 'درصد تخفیف باید بین ۱ و ۱۰۰ باشد.' : 'مبلغ تخفیف معتبر نیست.');
            return null;
        }

        $planId = Validate::nullableString(isset($data['plan_id']) ? (string) $data['plan_id'] : null);
        if ($planId !== null) {
            $plan = $pdo->prepare('SELECT 1 FROM plans WHERE id = :id');
            $plan->execute(['id' => $planId]);
            if ($plan->fetch() === false) {
                Response::error(404, 'plan_not_found', 'پلن انتخاب‌شده پیدا نشد.');
                return null;
            }
        }

        $maxUses = $data['max_uses'] ?? null;
        if ($maxUses === '' || $maxUses === null) {
            $maxUses = null;
        } elseif (!is_numeric($maxUses) || (int) $maxUses < 1 || (int) $maxUses > 1_000_000) {
            Response::error(400, 'invalid_max_uses', 'سقف استفاده باید عددی مثبت باشد، یا خالی برای نامحدود.');
            return null;
        } else {
            $maxUses = (int) $maxUses;
        }

        $expires = Validate::nullableString(isset($data['expires_at']) ? trim((string) $data['expires_at']) : null);
        if ($expires !== null) {
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $expires) || strtotime($expires) === false) {
                Response::error(400, 'invalid_date', 'تاریخ انقضا معتبر نیست.');
                return null;
            }
            $expires .= ' 23:59:59';
        }

        $note = Validate::nullableString(mb_substr(trim((string) ($data['note'] ?? '')), 0, 255));

        return [
            'code'          => $code,
            'kind'          => $kind,
            'value'         => (int) $value,
            'plan_id'       => $planId,
            'max_uses'      => $maxUses,
            'once_per_club' => !empty($data['once_per_club']) ? 1 : 0,
            'expires_at'    => $expires,
            'is_active'     => !array_key_exists('is_active', $data) || !empty($data['is_active']) ? 1 : 0,
            'note'          => $note,
        ];
    }
}
