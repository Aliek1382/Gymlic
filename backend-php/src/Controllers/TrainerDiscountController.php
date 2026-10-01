<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Auth;
use Gymlic\Cast;
use Gymlic\Database;
use Gymlic\Discounts;
use Gymlic\Response;
use Gymlic\TrainerBilling;
use Gymlic\TrainerDiscounts;
use Gymlic\Uuid;
use Gymlic\Validate;
use PDO;

/**
 * The admin's side of the discount codes for trainer plans: the same fields
 * and rules as the club codes (AdminBillingController), on their own table.
 * A code a trainer has used is part of that payment's record, so it can be
 * switched off but not deleted.
 */
final class TrainerDiscountController
{
    /** GET /admin/trainer-discounts */
    public static function list(): void
    {
        Auth::requireAdmin('finance');
        if (!TrainerBilling::ready()) {
            Response::ok(['ready' => false, 'items' => [], 'plans' => []]);
            return;
        }

        $pdo = Database::connection();
        $plans = Cast::rows(
            $pdo->query('SELECT id, name, price_toman, is_active FROM trainer_plans ORDER BY price_toman ASC')->fetchAll(),
            [],
            ['price_toman'],
            ['is_active']
        );
        if (!TrainerDiscounts::ready()) {
            Response::ok(['ready' => false, 'items' => [], 'plans' => $plans]);
            return;
        }

        $rows = $pdo->query(
            "SELECT d.id, d.code, d.kind, d.value, d.plan_id, p.name AS plan_name, d.max_uses,
                    d.once_per_trainer, d.expires_at, d.is_active, d.note, d.created_at,
                    (SELECT COUNT(*) FROM trainer_payment_requests r
                      WHERE r.discount_code_id = d.id AND r.status IN ('pending', 'approved')) AS uses,
                    (SELECT COALESCE(SUM(r.discount_toman), 0) FROM trainer_payment_requests r
                      WHERE r.discount_code_id = d.id AND r.status = 'approved') AS total_discount
             FROM trainer_discount_codes d
             LEFT JOIN trainer_plans p ON p.id = d.plan_id
             ORDER BY d.created_at DESC"
        )->fetchAll();

        Response::ok([
            'ready' => true,
            'items' => Cast::rows($rows, [], ['value', 'max_uses', 'uses', 'total_discount'], ['once_per_trainer', 'is_active']),
            'plans' => $plans,
        ]);
    }

    /** POST /admin/trainer-discounts */
    public static function create(): void
    {
        $admin = Auth::requireAdmin('finance');
        if (!self::ready()) {
            return;
        }
        $pdo = Database::connection();
        $fields = self::fields($pdo, Validate::body(), null);
        if ($fields === null) {
            return;
        }

        $id = Uuid::v4();
        $fields += ['id' => $id, 'created_by' => $admin['id']];
        $pdo->prepare(
            'INSERT INTO trainer_discount_codes (' . implode(', ', array_keys($fields)) . ')
             VALUES (:' . implode(', :', array_keys($fields)) . ')'
        )->execute($fields);

        AdminController::logActivity($pdo, null, $admin['id'], null, 'trainer_discount_code_saved', ['code' => $fields['code']]);
        Response::ok(['id' => $id], 201);
    }

    /** PATCH /admin/trainer-discounts/{id} */
    public static function update(array $params): void
    {
        $admin = Auth::requireAdmin('finance');
        if (!self::ready()) {
            return;
        }
        $pdo = Database::connection();
        $existing = $pdo->prepare('SELECT id FROM trainer_discount_codes WHERE id = :id');
        $existing->execute(['id' => $params['id']]);
        if ($existing->fetch() === false) {
            Response::error(404, 'not_found', 'کد تخفیف پیدا نشد.');
            return;
        }

        $fields = self::fields($pdo, Validate::body(), $params['id']);
        if ($fields === null) {
            return;
        }
        $set = implode(', ', array_map(static fn (string $k): string => "{$k} = :{$k}", array_keys($fields)));
        $pdo->prepare("UPDATE trainer_discount_codes SET {$set} WHERE id = :id")->execute($fields + ['id' => $params['id']]);

        AdminController::logActivity($pdo, null, $admin['id'], null, 'trainer_discount_code_saved', ['code' => $fields['code']]);
        Response::ok(['ok' => true]);
    }

    /** DELETE /admin/trainer-discounts/{id}: only a code nobody has used. */
    public static function delete(array $params): void
    {
        $admin = Auth::requireAdmin('finance');
        if (!self::ready()) {
            return;
        }
        $pdo = Database::connection();
        $code = $pdo->prepare('SELECT code FROM trainer_discount_codes WHERE id = :id');
        $code->execute(['id' => $params['id']]);
        $code = $code->fetchColumn();
        if ($code === false) {
            Response::error(404, 'not_found', 'کد تخفیف پیدا نشد.');
            return;
        }

        $used = $pdo->prepare('SELECT 1 FROM trainer_payment_requests WHERE discount_code_id = :id LIMIT 1');
        $used->execute(['id' => $params['id']]);
        if ($used->fetch() !== false) {
            Response::error(409, 'code_in_use', 'این کد در پرداخت‌های مربیان استفاده شده و سابقه‌اش باید بماند؛ به‌جای حذف، غیرفعالش کنید.');
            return;
        }

        $pdo->prepare('DELETE FROM trainer_discount_codes WHERE id = :id')->execute(['id' => $params['id']]);
        AdminController::logActivity($pdo, null, $admin['id'], null, 'trainer_discount_code_deleted', ['code' => $code]);
        Response::ok(['ok' => true]);
    }

    private static function ready(): bool
    {
        if (TrainerDiscounts::ready()) {
            return true;
        }
        Response::error(503, 'discounts_not_ready', 'کد تخفیف مربیان هنوز فعال نیست. به‌روزرسانی «کد تخفیف و یادآور پایان اشتراک مربی» را از صفحهٔ «به‌روزرسانی دیتابیس» اجرا کنید.');
        return false;
    }

    /**
     * The validated columns of a code, or null after answering 400/404/409.
     *
     * @return array<string, mixed>|null
     */
    private static function fields(PDO $pdo, array $data, ?string $id): ?array
    {
        $code = Discounts::normalizeCode($data['code'] ?? '');
        if (!Discounts::validCodeFormat($code)) {
            Response::error(400, 'invalid_code', 'کد باید ۳ تا ۴۰ حرف انگلیسی، عدد، - یا _ باشد.');
            return null;
        }
        $taken = $pdo->prepare('SELECT 1 FROM trainer_discount_codes WHERE code = :code AND id <> :id');
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
            $plan = $pdo->prepare('SELECT 1 FROM trainer_plans WHERE id = :id');
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

        return [
            'code'             => $code,
            'kind'             => $kind,
            'value'            => (int) $value,
            'plan_id'          => $planId,
            'max_uses'         => $maxUses,
            'once_per_trainer' => !empty($data['once_per_trainer']) ? 1 : 0,
            'expires_at'       => $expires,
            'is_active'        => !array_key_exists('is_active', $data) || !empty($data['is_active']) ? 1 : 0,
            'note'             => Validate::nullableString(mb_substr(trim((string) ($data['note'] ?? '')), 0, 255)),
        ];
    }
}
