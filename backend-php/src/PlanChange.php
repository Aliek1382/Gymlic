<?php
declare(strict_types=1);

namespace Gymlic;

use PDO;

/**
 * What buying a plan costs, and what it does, for a trainer or a club
 * that may already have one:
 *
 *   new     — no paid plan running (never bought, or ended): the full
 *             price, the plan starts on approval with its full period
 *   renew   — the plan already running: the full price, its days added
 *             to the current end date
 *   upgrade — a dearer plan while one is running: only the difference of
 *             the two prices; on approval the plan changes and the end
 *             date stays where it is (nothing for the remaining days)
 *   locked  — a cheaper (or same-price) plan while one is running: not
 *             sold until the period ends; then it is a "new" purchase
 *
 * "Running" is before the end date: in the grace days after it any plan
 * is a new purchase. Prices are the plans' prices now. The admin's
 * «تغییر پلن» moves an account to any plan without any of this.
 *
 * The kind is kept on the request (plan-upgrade-update.sql), so approving
 * it later does what was paid for. Before that update an upgrade is sold
 * as before (full price, a new period), and a cheaper plan is still locked.
 */
final class PlanChange
{
    public const NEW = 'new';

    public const RENEW = 'renew';

    public const UPGRADE = 'upgrade';

    /** Recorded by the admin's «تغییر پلن» when money came with it. */
    public const SWITCH = 'switch';

    private function __construct()
    {
    }

    /** Whether this request table keeps the kind (plan-upgrade-update.sql). */
    public static function ready(string $table): bool
    {
        return Database::hasColumn($table, 'purchase_kind');
    }

    /**
     * The trainer's running paid plan with its price now, or null.
     *
     * @return array{plan_id: ?string, plan_name: string, price_toman: ?int, expires_at: string}|null
     */
    public static function trainerCurrent(PDO $pdo, string $trainerId): ?array
    {
        if (!Limits::ready()) {
            $stmt = $pdo->prepare('SELECT NULL AS plan_id, plan_name, NULL AS price_toman, expires_at FROM trainer_subscriptions WHERE trainer_id = :id');
        } else {
            $stmt = $pdo->prepare(
                'SELECT s.plan_id, s.plan_name, p.price_toman, s.expires_at
                 FROM trainer_subscriptions s LEFT JOIN trainer_plans p ON p.id = s.plan_id
                 WHERE s.trainer_id = :id AND COALESCE(p.is_free, 0) = 0'
            );
        }
        $stmt->execute(['id' => $trainerId]);
        return self::running($stmt->fetch());
    }

    /** @return array{plan_id: ?string, plan_name: string, price_toman: ?int, expires_at: string}|null */
    public static function clubCurrent(PDO $pdo, string $clubId): ?array
    {
        $row = Subscriptions::latest($pdo, $clubId);
        if ($row === null) {
            return null;
        }
        $price = null;
        if ($row['plan_id'] !== null) {
            $stmt = $pdo->prepare('SELECT price_toman FROM plans WHERE id = :id');
            $stmt->execute(['id' => $row['plan_id']]);
            $value = $stmt->fetchColumn();
            $price = $value === false ? null : (int) $value;
        }
        return self::running(['plan_id' => $row['plan_id'], 'plan_name' => $row['plan_name'], 'price_toman' => $price, 'expires_at' => $row['expires_at']]);
    }

    /**
     * What buying $plan costs with $current running (or not).
     *
     * @param array{plan_id: ?string, plan_name: string, price_toman: ?int, expires_at: string}|null $current
     * @param array{id: string, price_toman: int|string} $plan
     * @return array{kind: string, price: int, from: ?array}|array{kind: 'locked', message: string}
     */
    public static function quote(?array $current, array $plan, string $table): array
    {
        $price = (int) $plan['price_toman'];
        if ($current === null) {
            return ['kind' => self::NEW, 'price' => $price, 'from' => null];
        }
        if ($current['plan_id'] !== null && $current['plan_id'] === $plan['id']) {
            return ['kind' => self::RENEW, 'price' => $price, 'from' => null];
        }
        // A plan we can't price (from before plan ids were kept, or since
        // deleted): sold as a new period, as before.
        if ($current['plan_id'] === null || $current['price_toman'] === null) {
            return ['kind' => self::NEW, 'price' => $price, 'from' => null];
        }

        $from = (int) $current['price_toman'];
        if ($price <= $from) {
            return [
                'kind'    => 'locked',
                'message' => 'تا پایان دورهٔ پلن فعلی («' . $current['plan_name'] . '»، تا '
                    . Jalali::format($current['expires_at'], true) . ') فقط ارتقا به پلن گران‌تر ممکن است؛ '
                    . ($price === $from ? 'پلن هم‌قیمت' : 'پلن ارزان‌تر') . ' را پس از پایان دوره بخرید.',
            ];
        }
        if (!self::ready($table)) {
            return ['kind' => self::NEW, 'price' => $price, 'from' => null];
        }
        return [
            'kind'  => self::UPGRADE,
            'price' => $price - $from,
            'from'  => ['plan_id' => $current['plan_id'], 'plan_name' => $current['plan_name'], 'price_toman' => $from],
        ];
    }

    /**
     * Every plan's quote, for the purchase dialog.
     *
     * @param list<array{id: string, price_toman: int|string}> $plans
     * @param array{plan_id: ?string, plan_name: string, price_toman: ?int, expires_at: string}|null $current
     * @return array{ready: bool, current: ?array, plans: array<string, array>}
     */
    public static function options(?array $current, array $plans, string $table): array
    {
        $out = [];
        foreach ($plans as $plan) {
            $quote = self::quote($current, $plan, $table);
            $out[$plan['id']] = $quote['kind'] === 'locked'
                ? ['kind' => 'locked', 'message' => $quote['message']]
                : ['kind' => $quote['kind'], 'price_toman' => $quote['price']];
        }
        return ['ready' => self::ready($table), 'current' => $current, 'plans' => $out];
    }

    /** The columns a request keeps, when the table has them. @return array<string, mixed> */
    public static function columns(array $quote, string $table): array
    {
        if (!self::ready($table)) {
            return [];
        }
        return [
            'purchase_kind'    => $quote['kind'],
            'from_plan_id'     => $quote['from']['plan_id'] ?? null,
            'from_price_toman' => $quote['from']['price_toman'] ?? null,
        ];
    }

    /** The 409 for a plan that is locked until the period ends. */
    public static function lockedError(array $quote): void
    {
        Response::error(409, 'downgrade_locked', $quote['message']);
    }

    /** @return array{plan_id: ?string, plan_name: string, price_toman: ?int, expires_at: string}|null */
    private static function running(array|false $row): ?array
    {
        if ($row === false || $row['expires_at'] === null || strtotime((string) $row['expires_at']) <= time()) {
            return null;
        }
        return [
            'plan_id'     => $row['plan_id'],
            'plan_name'   => (string) $row['plan_name'],
            'price_toman' => $row['price_toman'] === null ? null : (int) $row['price_toman'],
            'expires_at'  => (string) $row['expires_at'],
        ];
    }
}
