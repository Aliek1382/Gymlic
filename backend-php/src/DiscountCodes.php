<?php
declare(strict_types=1);

namespace Gymlic;

use PDO;

/**
 * The rules shared by the discount codes people hand out themselves: a
 * club's codes for its membership plans (club_discount_codes, paid in
 * membership_payment_requests) and a trainer's codes for their athletes'
 * invoices (athlete_discount_codes, used on invoice_payment_claims). They
 * work like the platform's own codes (Discounts, TrainerDiscounts), scoped to
 * whoever created them.
 *
 * A "config" names the tables involved:
 *   table        the codes table
 *   scopeColumn  the column that says whose code it is (club_id / trainer_id)
 *   onceColumn   the "only once per person" flag column
 *   usesTable    where a use is recorded (rows with discount_code_id and a status)
 *   payerColumn  the column of usesTable that says who paid
 *   planTable    the plans a code can be limited to, or null
 * All of it is fixed in code, never taken from a request.
 *
 * A use is a payment that carries the code and is pending or approved: a
 * rejected payment gives its use back.
 */
final class DiscountCodes
{
    public const CLUB = [
        'table'       => 'club_discount_codes',
        'scopeColumn' => 'club_id',
        'onceColumn'  => 'once_per_member',
        'usesTable'   => 'membership_payment_requests',
        'payerColumn' => 'athlete_id',
        'planTable'   => 'club_membership_plans',
    ];

    public const TRAINER = [
        'table'       => 'athlete_discount_codes',
        'scopeColumn' => 'trainer_id',
        'onceColumn'  => 'once_per_athlete',
        'usesTable'   => 'invoice_payment_claims',
        'payerColumn' => 'athlete_id',
        'planTable'   => null,
    ];

    private function __construct()
    {
    }

    /** Whether a club's codes (and their use on membership payments) can be used yet. */
    public static function clubReady(): bool
    {
        return Database::hasTable('club_discount_codes')
            && Database::hasColumn('membership_payment_requests', 'discount_code_id');
    }

    /** Whether a trainer's codes (and their use on invoice claims) can be used yet. */
    public static function trainerReady(): bool
    {
        return Database::hasTable('athlete_discount_codes')
            && Database::hasColumn('invoice_payment_claims', 'discount_code_id');
    }

    public static function uses(PDO $pdo, array $cfg, string $codeId, ?string $payerId = null): int
    {
        $sql = "SELECT COUNT(*) FROM {$cfg['usesTable']}
                WHERE discount_code_id = :code_id AND status IN ('pending', 'approved')";
        $bind = ['code_id' => $codeId];
        if ($payerId !== null) {
            $sql .= " AND {$cfg['payerColumn']} = :payer";
            $bind['payer'] = $payerId;
        }
        $stmt = $pdo->prepare($sql);
        $stmt->execute($bind);

        return (int) $stmt->fetchColumn();
    }

    /**
     * Whether $code applies to a payment of $price by $payerId, within the
     * scope $scopeId (the club or the trainer). On success: the code row, the
     * price, the toman off and what is left to pay (always at least 1: a code
     * that would make it free is refused, the owner can extend by hand). With
     * $lock the code row stays locked until the caller's transaction ends.
     *
     * @return array{ok: true, code: array, list_price: int, discount: int, final: int}
     *       | array{ok: false, error: string, message: string}
     */
    public static function evaluate(
        PDO $pdo,
        array $cfg,
        string $scopeId,
        string $code,
        int $price,
        ?string $planId,
        string $payerId,
        bool $lock = false
    ): array {
        $planJoin = $cfg['planTable'] !== null ? "LEFT JOIN {$cfg['planTable']} p ON p.id = d.plan_id" : '';
        $planName = $cfg['planTable'] !== null ? ', p.name AS plan_name' : '';
        $stmt = $pdo->prepare(
            "SELECT d.*{$planName} FROM {$cfg['table']} d {$planJoin}
             WHERE d.{$cfg['scopeColumn']} = :scope AND d.code = :code" . ($lock ? ' FOR UPDATE' : '')
        );
        $stmt->execute(['scope' => $scopeId, 'code' => Discounts::normalizeCode($code)]);
        $row = $stmt->fetch();

        if ($row === false || !(bool) $row['is_active']) {
            return self::fail('invalid_code', 'کد تخفیف معتبر نیست.');
        }
        if ($row['expires_at'] !== null && strtotime((string) $row['expires_at']) <= time()) {
            return self::fail('code_expired', 'مهلت استفاده از این کد تخفیف تمام شده است.');
        }
        if (($row['plan_id'] ?? null) !== null && $row['plan_id'] !== $planId) {
            return self::fail('code_wrong_plan', 'این کد تخفیف فقط برای طرح «' . $row['plan_name'] . '» است.');
        }
        if ($row['max_uses'] !== null && self::uses($pdo, $cfg, $row['id']) >= (int) $row['max_uses']) {
            return self::fail('code_used_up', 'ظرفیت استفاده از این کد تخفیف تمام شده است.');
        }
        if ((bool) $row[$cfg['onceColumn']] && self::uses($pdo, $cfg, $row['id'], $payerId) > 0) {
            return self::fail('code_already_used', 'شما قبلاً از این کد تخفیف استفاده کرده‌اید.');
        }

        $discount = Discounts::amountOff($row, $price);
        if ($price - $discount < 1) {
            return self::fail('code_covers_all', 'این کد تخفیف کل مبلغ را می‌پوشاند؛ برای رایگان‌شدن با مسئول مربوط هماهنگ کنید.');
        }

        return ['ok' => true, 'code' => $row, 'list_price' => $price, 'discount' => $discount, 'final' => $price - $discount];
    }

    /**
     * The columns every code has, validated from a request body ($onceKey is
     * the name of the "once per person" field in this table). The scope and
     * the plan are the caller's to check.
     *
     * @return array{ok: true, fields: array<string, mixed>}|array{ok: false, status: int, error: string, message: string}
     */
    public static function parseFields(array $data, string $onceKey): array
    {
        $code = Discounts::normalizeCode($data['code'] ?? '');
        if (!Discounts::validCodeFormat($code)) {
            return self::bad(400, 'invalid_code', 'کد باید ۳ تا ۴۰ حرف انگلیسی، عدد، - یا _ باشد.');
        }
        $kind = $data['kind'] ?? '';
        if (!in_array($kind, ['percent', 'amount'], true)) {
            return self::bad(400, 'invalid_kind', 'نوع تخفیف باید درصدی یا مبلغی باشد.');
        }
        $value = $data['value'] ?? null;
        // 100% would make the payment free, which a code is never allowed to do.
        $max = $kind === 'percent' ? 99 : 1_000_000_000_000;
        if (!is_numeric($value) || (int) $value < 1 || (int) $value > $max) {
            return self::bad(400, 'invalid_value', $kind === 'percent' ? 'درصد تخفیف باید بین ۱ و ۹۹ باشد.' : 'مبلغ تخفیف معتبر نیست.');
        }

        $maxUses = $data['max_uses'] ?? null;
        if ($maxUses === '' || $maxUses === null) {
            $maxUses = null;
        } elseif (!is_numeric($maxUses) || (int) $maxUses < 1 || (int) $maxUses > 1_000_000) {
            return self::bad(400, 'invalid_max_uses', 'سقف استفاده باید عددی مثبت باشد، یا خالی برای نامحدود.');
        } else {
            $maxUses = (int) $maxUses;
        }

        $expires = Validate::nullableString(isset($data['expires_at']) ? trim((string) $data['expires_at']) : null);
        if ($expires !== null) {
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $expires) || strtotime($expires) === false) {
                return self::bad(400, 'invalid_date', 'تاریخ انقضا معتبر نیست.');
            }
            $expires .= ' 23:59:59';
        }

        return ['ok' => true, 'fields' => [
            'code'     => $code,
            'kind'     => $kind,
            'value'    => (int) $value,
            'max_uses' => $maxUses,
            $onceKey   => !empty($data[$onceKey]) ? 1 : 0,
            'expires_at' => $expires,
            'is_active'  => !array_key_exists('is_active', $data) || !empty($data['is_active']) ? 1 : 0,
            'note'       => Validate::nullableString(mb_substr(trim((string) ($data['note'] ?? '')), 0, 255)),
        ]];
    }

    /** @return array{ok: false, error: string, message: string} */
    private static function fail(string $error, string $message): array
    {
        return ['ok' => false, 'error' => $error, 'message' => $message];
    }

    /** @return array{ok: false, status: int, error: string, message: string} */
    private static function bad(int $status, string $error, string $message): array
    {
        return ['ok' => false, 'status' => $status, 'error' => $error, 'message' => $message];
    }
}
