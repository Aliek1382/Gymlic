<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\AdminAccess;
use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\Discounts;
use Gymlic\Jalali;
use Gymlic\Response;

/**
 * CSV downloads of the admin lists, for Excel. UTF-8 with a BOM, which is
 * what makes Excel read Persian text correctly; dates in the Jalali
 * calendar. Every download is written to the activity log: these files
 * carry people's phone numbers and emails.
 */
final class ExportController
{
    private const KINDS = [
        'users'         => 'users.view',
        'payments'      => 'finance',
        'subscriptions' => 'finance',
        'revenue'       => 'finance',
    ];

    private const ACCOUNT_TYPES = ['club' => 'باشگاه', 'trainer' => 'مربی', 'athlete' => 'ورزشکار'];
    private const REQUEST_STATUS = ['pending' => 'در انتظار', 'approved' => 'تأییدشده', 'rejected' => 'ردشده'];
    private const SUB_STATUS = ['active' => 'فعال', 'expiring' => 'رو به اتمام', 'expired' => 'منقضی'];
    private const CLUB_STATUS = ['active' => 'فعال', 'suspended' => 'تعلیق', 'pending' => 'در انتظار تأیید'];

    public static function download(array $params): void
    {
        $kind = $params['kind'] ?? '';
        if (!isset(self::KINDS[$kind])) {
            Response::error(404, 'unknown_export', 'این خروجی وجود ندارد.');
            return;
        }
        $admin = Auth::requireAdmin(self::KINDS[$kind]);

        $rows = match ($kind) {
            'users'         => self::users(),
            'payments'      => self::payments(),
            'subscriptions' => self::subscriptions(),
            'revenue'       => self::revenue(),
        };

        AdminController::logActivity(Database::connection(), null, $admin['id'], null, 'data_exported', [
            'kind' => $kind,
            'rows' => count($rows) - 1,
        ]);

        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="gymlic-' . $kind . '-' . date('Ymd') . '.csv"');
        header('Cache-Control: no-store');

        $out = fopen('php://output', 'wb');
        fwrite($out, "\xEF\xBB\xBF");
        foreach ($rows as $row) {
            fputcsv($out, array_map([self::class, 'cell'], $row), ',', '"', '');
        }
        fclose($out);
        exit;
    }

    /**
     * A spreadsheet runs a cell that starts with = + - or @ as a formula, so
     * text a user typed (a name, a note) gets a leading quote. Phone and
     * card-like numbers are written as ="0912…" so Excel keeps the leading 0.
     */
    private static function cell(mixed $value): string
    {
        if ($value === null) {
            return '';
        }
        if (is_bool($value)) {
            return $value ? 'بله' : 'خیر';
        }
        if (is_int($value)) {
            return (string) $value;
        }
        $text = (string) $value;
        if (preg_match('/^\+?0\d{5,}$/', $text) === 1) {
            return '="' . $text . '"';
        }
        if ($text !== '' && strpbrk($text[0], "=+-@\t\r") !== false) {
            return "'" . $text;
        }
        return $text;
    }

    /** @return list<list<mixed>> */
    private static function users(): array
    {
        $roles = AdminAccess::rolesReady();
        $stmt = Database::connection()->query(
            'SELECT p.first_name, p.last_name, p.email, p.phone, p.account_type, p.birth_date,
                    p.is_suspended, p.is_platform_admin, p.created_at'
            . ($roles ? ', r.name AS admin_role_name' : ', NULL AS admin_role_name') . '
             FROM profiles p'
            . ($roles ? ' LEFT JOIN admin_roles r ON r.id = p.admin_role_id' : '') . '
             ORDER BY p.created_at DESC'
        );

        $rows = [['نام', 'نام خانوادگی', 'ایمیل', 'موبایل', 'نوع حساب', 'تاریخ تولد', 'تاریخ ثبت‌نام', 'مسدود', 'دسترسی مدیریت']];
        foreach ($stmt->fetchAll() as $r) {
            $rows[] = [
                $r['first_name'],
                $r['last_name'],
                $r['email'],
                $r['phone'],
                self::ACCOUNT_TYPES[$r['account_type'] ?? ''] ?? '',
                Jalali::format($r['birth_date']),
                Jalali::format($r['created_at']),
                (bool) $r['is_suspended'],
                (bool) $r['is_platform_admin'] ? 'مدیر کل' : ($r['admin_role_name'] ?? ''),
            ];
        }
        return $rows;
    }

    /** @return list<list<mixed>> */
    private static function payments(): array
    {
        $discounts = Discounts::ready();
        $stmt = Database::connection()->query(
            'SELECT pr.created_at, c.name AS club_name, p.name AS plan_name, pr.amount_toman, pr.status,
                    pr.reference_note, pr.admin_note, pr.reviewed_at,
                    (pr.submitted_by <> c.owner_id) AS recorded_by_admin'
            . ($discounts ? ', pr.list_price_toman, pr.discount_toman, d.code AS discount_code' : '') . '
             FROM payment_requests pr
             JOIN clubs c ON c.id = pr.club_id
             JOIN plans p ON p.id = pr.plan_id'
            . ($discounts ? ' LEFT JOIN discount_codes d ON d.id = pr.discount_code_id' : '') . '
             ORDER BY pr.created_at DESC'
        );

        $rows = [['تاریخ ثبت', 'باشگاه', 'پلن', 'مبلغ پرداختی (تومان)', 'قیمت پلن (تومان)', 'تخفیف (تومان)', 'کد تخفیف', 'وضعیت', 'تاریخ بررسی', 'توضیح باشگاه', 'یادداشت مدیریت', 'ثبت دستی مدیر']];
        foreach ($stmt->fetchAll() as $r) {
            $rows[] = [
                Jalali::format($r['created_at']),
                $r['club_name'],
                $r['plan_name'],
                (int) $r['amount_toman'],
                isset($r['list_price_toman']) ? (int) $r['list_price_toman'] : null,
                isset($r['discount_toman']) && (int) $r['discount_toman'] > 0 ? (int) $r['discount_toman'] : null,
                $r['discount_code'] ?? null,
                self::REQUEST_STATUS[$r['status']] ?? $r['status'],
                Jalali::format($r['reviewed_at']),
                $r['reference_note'],
                $r['admin_note'],
                (bool) $r['recorded_by_admin'],
            ];
        }
        return $rows;
    }

    /** @return list<list<mixed>> */
    private static function subscriptions(): array
    {
        $rows = [['باشگاه', 'مالک', 'موبایل مالک', 'ایمیل مالک', 'وضعیت باشگاه', 'پلن', 'شروع', 'انقضا', 'وضعیت اشتراک', 'روز باقی‌مانده', 'اعضای فعال', 'ظرفیت عضو']];
        foreach (AdminController::clubRows() as $r) {
            $rows[] = [
                $r['name'],
                trim(($r['owner_first_name'] ?? '') . ' ' . ($r['owner_last_name'] ?? '')),
                $r['owner_phone'],
                $r['owner_email'],
                self::CLUB_STATUS[$r['status']] ?? $r['status'],
                $r['plan_name'],
                Jalali::format($r['subscription_started_at']),
                Jalali::format($r['subscription_expires_at']),
                $r['subscription_status'] !== null ? self::SUB_STATUS[$r['subscription_status']] : 'بدون اشتراک',
                $r['subscription_remaining_days'],
                $r['member_count'],
                $r['member_capacity'] ?? 'بدون محدودیت',
            ];
        }
        return $rows;
    }

    /** Approved payments per Jalali month, newest first. @return list<list<mixed>> */
    private static function revenue(): array
    {
        $rows = [['ماه', 'تعداد پرداخت تأییدشده', 'جمع دریافتی (تومان)', 'جمع تخفیف (تومان)']];
        foreach (AdminBillingController::revenueSummary()['months'] as $m) {
            $rows[] = [$m['month'], $m['count'], $m['total'], $m['discount']];
        }
        return $rows;
    }
}
