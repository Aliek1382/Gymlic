<?php
declare(strict_types=1);

namespace Gymlic;

use PDO;

/**
 * Discount codes a club enters when it files a payment for a plan.
 *
 * A use is a payment request that carries the code and is pending or
 * approved: a rejected request gives its use back, so a club whose transfer
 * was refused can try again with the same code.
 */
final class Discounts
{
    private function __construct()
    {
    }

    /** False until finance-update.sql has been run on this database. */
    public static function ready(): bool
    {
        return Database::hasColumn('payment_requests', 'discount_code_id')
            && Database::hasColumn('discount_codes', 'code');
    }

    /** Upper-case Latin letters, digits, - and _ (Persian digits converted). */
    public static function normalizeCode(mixed $code): string
    {
        $code = strtr(trim((string) $code), [
            '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
            '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
        ]);
        return strtoupper(preg_replace('/\s+/', '', $code) ?? '');
    }

    public static function validCodeFormat(string $code): bool
    {
        return preg_match('/^[A-Z0-9_-]{3,40}$/', $code) === 1;
    }

    /** Toman off $price; never more than the price itself. */
    public static function amountOff(array $code, int $price): int
    {
        $off = $code['kind'] === 'percent'
            ? intdiv($price * min(100, (int) $code['value']), 100)
            : (int) $code['value'];
        return max(0, min($price, $off));
    }

    public static function uses(PDO $pdo, string $codeId, ?string $clubId = null): int
    {
        $sql = "SELECT COUNT(*) FROM payment_requests
                WHERE discount_code_id = :code_id AND status IN ('pending', 'approved')";
        $bind = ['code_id' => $codeId];
        if ($clubId !== null) {
            $sql .= ' AND club_id = :club_id';
            $bind['club_id'] = $clubId;
        }
        $stmt = $pdo->prepare($sql);
        $stmt->execute($bind);
        return (int) $stmt->fetchColumn();
    }

    /**
     * Whether $code applies to $plan for $clubId. On success: the code row,
     * the plan price, the toman off and what is left to pay. With $lock the
     * code row stays locked until the caller's transaction ends, so two clubs
     * can't both take the last use.
     *
     * @param array{id: string, name: string, price_toman: int|string} $plan
     * @return array{ok: true, code: array, list_price: int, discount: int, final: int}
     *       | array{ok: false, error: string, message: string}
     */
    public static function evaluate(PDO $pdo, string $code, array $plan, string $clubId, bool $lock = false): array
    {
        $stmt = $pdo->prepare(
            'SELECT d.*, p.name AS plan_name FROM discount_codes d
             LEFT JOIN plans p ON p.id = d.plan_id
             WHERE d.code = :code' . ($lock ? ' FOR UPDATE' : '')
        );
        $stmt->execute(['code' => self::normalizeCode($code)]);
        $row = $stmt->fetch();

        if ($row === false || !(bool) $row['is_active']) {
            return self::fail('invalid_code', 'کد تخفیف معتبر نیست.');
        }
        if ($row['expires_at'] !== null && strtotime((string) $row['expires_at']) <= time()) {
            return self::fail('code_expired', 'مهلت استفاده از این کد تخفیف تمام شده است.');
        }
        if ($row['plan_id'] !== null && $row['plan_id'] !== $plan['id']) {
            return self::fail('code_wrong_plan', 'این کد تخفیف فقط برای پلن «' . $row['plan_name'] . '» است.');
        }
        if ($row['max_uses'] !== null && self::uses($pdo, $row['id']) >= (int) $row['max_uses']) {
            return self::fail('code_used_up', 'ظرفیت استفاده از این کد تخفیف تمام شده است.');
        }
        if ((bool) $row['once_per_club'] && self::uses($pdo, $row['id'], $clubId) > 0) {
            return self::fail('code_already_used', 'باشگاه شما قبلاً از این کد تخفیف استفاده کرده است.');
        }

        $price = (int) $plan['price_toman'];
        $discount = self::amountOff($row, $price);

        return ['ok' => true, 'code' => $row, 'list_price' => $price, 'discount' => $discount, 'final' => $price - $discount];
    }

    /** @return array{ok: false, error: string, message: string} */
    private static function fail(string $error, string $message): array
    {
        return ['ok' => false, 'error' => $error, 'message' => $message];
    }
}
