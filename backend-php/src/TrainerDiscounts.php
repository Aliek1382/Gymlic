<?php
declare(strict_types=1);

namespace Gymlic;

use PDO;

/**
 * Discount codes a trainer enters when buying a trainer plan: the same rules
 * as the club codes (Discounts), in their own table so the two can't mix.
 *
 * A use is a payment request that carries the code and is pending or
 * approved; a rejected request gives its use back.
 */
final class TrainerDiscounts
{
    private function __construct()
    {
    }

    /** False until trainer-billing-extras-update.sql has been run on this database. */
    public static function ready(): bool
    {
        return Database::hasTable('trainer_discount_codes')
            && Database::hasColumn('trainer_payment_requests', 'discount_code_id');
    }

    /** False until trainer-discount-owner-update.sql: no code can be tied to one trainer yet. */
    public static function personalReady(): bool
    {
        return self::ready() && Database::hasColumn('trainer_discount_codes', 'for_trainer_id');
    }

    public static function uses(PDO $pdo, string $codeId, ?string $trainerId = null): int
    {
        $sql = "SELECT COUNT(*) FROM trainer_payment_requests
                WHERE discount_code_id = :code_id AND status IN ('pending', 'approved')";
        $bind = ['code_id' => $codeId];
        if ($trainerId !== null) {
            $sql .= ' AND trainer_id = :trainer_id';
            $bind['trainer_id'] = $trainerId;
        }
        $stmt = $pdo->prepare($sql);
        $stmt->execute($bind);

        return (int) $stmt->fetchColumn();
    }

    /**
     * Whether $code applies to $plan for $trainerId. On success: the code row,
     * the plan price, the toman off and what is left to pay. With $lock the
     * code row stays locked until the caller's transaction ends, so two
     * trainers can't both take the last use.
     *
     * @param array{id: string, name: string, price_toman: int|string} $plan
     * @return array{ok: true, code: array, list_price: int, discount: int, final: int}
     *       | array{ok: false, error: string, message: string}
     */
    public static function evaluate(PDO $pdo, string $code, array $plan, string $trainerId, bool $lock = false): array
    {
        $stmt = $pdo->prepare(
            'SELECT d.*, p.name AS plan_name FROM trainer_discount_codes d
             LEFT JOIN trainer_plans p ON p.id = d.plan_id
             WHERE d.code = :code' . ($lock ? ' FOR UPDATE' : '')
        );
        $stmt->execute(['code' => Discounts::normalizeCode($code)]);
        $row = $stmt->fetch();

        // A code that belongs to another trainer reads as no code at all.
        if ($row === false || !(bool) $row['is_active']
            || (($row['for_trainer_id'] ?? null) !== null && $row['for_trainer_id'] !== $trainerId)) {
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
        if ((bool) $row['once_per_trainer'] && self::uses($pdo, $row['id'], $trainerId) > 0) {
            return self::fail('code_already_used', 'شما قبلاً از این کد تخفیف استفاده کرده‌اید.');
        }

        $price = (int) $plan['price_toman'];
        $discount = Discounts::amountOff($row, $price);

        return ['ok' => true, 'code' => $row, 'list_price' => $price, 'discount' => $discount, 'final' => $price - $discount];
    }

    /** @return array{ok: false, error: string, message: string} */
    private static function fail(string $error, string $message): array
    {
        return ['ok' => false, 'error' => $error, 'message' => $message];
    }
}
