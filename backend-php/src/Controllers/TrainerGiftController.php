<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Auth;
use Gymlic\Birthdays;
use Gymlic\Database;
use Gymlic\Jalali;
use Gymlic\Response;
use Gymlic\Templates;
use Gymlic\TrainerDiscounts;
use Gymlic\Uuid;
use Gymlic\Validate;
use PDO;

/**
 * The admin's gift to one trainer: a discount code on a trainer plan that
 * only that trainer can use, once, sent to them as a notification. For a
 * birthday (once per trainer per Jalali year), or any other occasion.
 * Needs trainer-discount-owner-update.sql: without it a code can't be tied
 * to one trainer, so nothing is made.
 */
final class TrainerGiftController
{
    private const DEFAULT_PERCENT = 20;

    private const DEFAULT_DAYS = 14;

    /** GET /admin/trainer-birthdays: the coming week's trainer birthdays. */
    public static function birthdays(): void
    {
        Auth::requireAdmin('users.view');
        $pdo = Database::connection();
        $rows = Birthdays::trainers($pdo, 7);
        $year = Birthdays::jalaliYear();

        $gifted = [];
        if ($rows !== []) {
            $stmt = $pdo->prepare(
                "SELECT subject_id FROM activity_logs WHERE action = 'trainer_gift_code' AND subject_id IN ("
                . implode(',', array_fill(0, count($rows), '?')) . ')
                 AND metadata LIKE ?'
            );
            $stmt->execute(array_merge(array_column($rows, 'id'), ['%"occasion":"birthday","year":' . $year . ',%']));
            $gifted = array_flip($stmt->fetchAll(PDO::FETCH_COLUMN));
        }

        Response::ok([
            'ready'   => TrainerDiscounts::personalReady(),
            'year'    => $year,
            'items'   => array_map(static fn (array $r): array => $r + ['gifted' => isset($gifted[$r['id']])], $rows),
        ]);
    }

    /**
     * POST /admin/trainers/{id}/gift-code
     * body: occasion ('birthday' | 'gift'), percent (1..100, default 20),
     * days (1..90, default 14), message (optional, at most 200).
     */
    public static function create(array $params): void
    {
        $admin = Auth::requireAdmin('finance');
        if (!TrainerDiscounts::personalReady()) {
            Response::error(503, 'update_required', 'کد اختصاصی بعد از به‌روزرسانی «کد تخفیف اختصاصی یک مربی» در دسترس است.');
            return;
        }
        $pdo = Database::connection();
        $data = Validate::body();

        $trainer = $pdo->prepare("SELECT id, first_name, last_name FROM profiles WHERE id = :id AND account_type = 'trainer'");
        $trainer->execute(['id' => $params['id']]);
        $trainer = $trainer->fetch();
        if ($trainer === false) {
            Response::error(404, 'not_found', 'مربی پیدا نشد.');
            return;
        }

        $occasion = ($data['occasion'] ?? 'gift') === 'birthday' ? 'birthday' : 'gift';
        $percent = (int) ($data['percent'] ?? self::DEFAULT_PERCENT);
        $days = (int) ($data['days'] ?? self::DEFAULT_DAYS);
        if ($percent < 1 || $percent > 100) {
            Response::error(400, 'invalid_value', 'درصد تخفیف باید بین ۱ و ۱۰۰ باشد.');
            return;
        }
        if ($days < 1 || $days > 90) {
            Response::error(400, 'invalid_days', 'مدت اعتبار باید بین ۱ و ۹۰ روز باشد.');
            return;
        }
        $message = trim((string) ($data['message'] ?? ''));
        if (mb_strlen($message) > 200) {
            Response::error(400, 'message_too_long', 'متن پیام حداکثر ۲۰۰ نویسه است.');
            return;
        }
        if ($message === '') {
            $message = $occasion === 'birthday' ? 'تولدتان مبارک!' : 'هدیه‌ای از طرف جیم‌لیک برای شما.';
        }
        $year = Birthdays::jalaliYear();

        $pdo->beginTransaction();
        try {
            // One birthday gift per trainer per year, even with two clicks at once.
            $pdo->prepare('SELECT id FROM profiles WHERE id = :id FOR UPDATE')->execute(['id' => $trainer['id']]);
            if ($occasion === 'birthday') {
                $sent = $pdo->prepare(
                    "SELECT 1 FROM activity_logs WHERE action = 'trainer_gift_code' AND subject_id = :t AND metadata LIKE :m LIMIT 1"
                );
                $sent->execute(['t' => $trainer['id'], 'm' => '%"occasion":"birthday","year":' . $year . ',%']);
                if ($sent->fetch() !== false) {
                    $pdo->rollBack();
                    Response::error(409, 'already_gifted', 'هدیه‌ی تولد امسال این مربی قبلاً فرستاده شده است.');
                    return;
                }
            }

            $code = self::newCode($pdo, $occasion === 'birthday' ? 'BDAY' : 'GIFT');
            $expires = date('Y-m-d', (int) strtotime("+{$days} days")) . ' 23:59:59';
            $name = trim(($trainer['first_name'] ?? '') . ' ' . ($trainer['last_name'] ?? ''));
            $pdo->prepare(
                "INSERT INTO trainer_discount_codes
                   (id, code, kind, value, plan_id, for_trainer_id, max_uses, once_per_trainer, expires_at, is_active, note, created_by)
                 VALUES (:id, :code, 'percent', :value, NULL, :t, 1, 1, :expires, 1, :note, :admin)"
            )->execute([
                'id'      => Uuid::v4(),
                'code'    => $code,
                'value'   => $percent,
                't'       => $trainer['id'],
                'expires' => $expires,
                'note'    => mb_substr(($occasion === 'birthday' ? 'هدیه‌ی تولد ' . $year : 'هدیه') . ' — ' . ($name ?: 'مربی'), 0, 255),
                'admin'   => $admin['id'],
            ]);

            AdminController::logActivity($pdo, null, $admin['id'], $trainer['id'], 'trainer_gift_code', [
                'occasion' => $occasion,
                'year'     => $year,
                'code'     => $code,
                'percent'  => $percent,
                'expires'  => substr($expires, 0, 10),
            ]);
            Templates::notify($pdo, 'trainer_gift_code', $trainer['id'], $admin['id'], 'trainer_gift_code', [
                'message' => $message,
                'code'    => $code,
                'percent' => self::fa($percent),
                'date'    => Jalali::format($expires, true),
            ], '/subscription', ['code' => $code]);
            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        Response::ok(['code' => $code, 'percent' => $percent, 'expires_at' => $expires], 201);
    }

    /** "BDAY-7KQ2MX": a prefix and six letters/digits nobody has yet (no 0/O, 1/I). */
    private static function newCode(PDO $pdo, string $prefix): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $taken = $pdo->prepare('SELECT 1 FROM trainer_discount_codes WHERE code = :code');
        do {
            $code = $prefix . '-';
            for ($i = 0; $i < 6; $i++) {
                $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            }
            $taken->execute(['code' => $code]);
        } while ($taken->fetch() !== false);
        return $code;
    }

    private static function fa(int $n): string
    {
        return strtr((string) $n, ['0' => '۰', '1' => '۱', '2' => '۲', '3' => '۳', '4' => '۴', '5' => '۵', '6' => '۶', '7' => '۷', '8' => '۸', '9' => '۹']);
    }
}
