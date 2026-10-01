<?php
declare(strict_types=1);

namespace Gymlic;

use DateTimeImmutable;
use DateTimeZone;
use PDO;
use Throwable;

/**
 * The weekly summary emailed to the platform's owner: sign-ups, revenue,
 * support tickets and subscriptions running out, for the last 7 days. Sent
 * on Saturday morning (Iran time) by cron/notification-dispatch.php, which
 * already runs every few minutes, so the host needs no new cron job.
 * Recipients and the on/off switch are the "reports" settings group.
 */
final class WeeklyReport
{
    private const STATE_KEY = 'cron.weekly-report';

    private function __construct()
    {
    }

    /** Sends it when it's Saturday past the hour and this Saturday's hasn't gone yet. Never throws. */
    public static function sendIfDue(PDO $pdo): ?string
    {
        try {
            $settings = Settings::get('reports');
            if (!$settings['weekly_enabled'] || $settings['recipients'] === []) {
                return null;
            }
            $now = new DateTimeImmutable('now', new DateTimeZone('Asia/Tehran'));
            if ((int) $now->format('w') !== 6 || (int) $now->format('G') < $settings['send_hour']) {
                return null;
            }
            $last = self::lastSent($pdo);
            if ($last !== null && $last['date'] === $now->format('Y-m-d')) {
                return null;
            }
            $result = self::send($pdo, $settings['recipients']);
            return "weekly report: sent to {$result['sent']} of " . count($settings['recipients']);
        } catch (Throwable $e) {
            error_log('weekly report: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Builds and sends it now (also the admin's "send now").
     *
     * @param list<string> $recipients
     * @return array{sent: int, failed: list<array{email: string, error: string}>}
     */
    public static function send(PDO $pdo, array $recipients): array
    {
        $report = self::build($pdo);
        $sent = 0;
        $failed = [];
        foreach ($recipients as $email) {
            if (MailGateway::send($email, $report['subject'], $report['text'])) {
                $sent++;
            } else {
                $failed[] = ['email' => $email, 'error' => MailGateway::lastError()];
            }
        }
        $now = new DateTimeImmutable('now', new DateTimeZone('Asia/Tehran'));
        try {
            $pdo->prepare(
                'INSERT INTO app_settings (setting_key, value) VALUES (:key, :value)
                 ON DUPLICATE KEY UPDATE value = VALUES(value)'
            )->execute([
                'key'   => self::STATE_KEY,
                'value' => json_encode([
                    'at'      => date('Y-m-d H:i:s'),
                    'date'    => $now->format('Y-m-d'),
                    'sent'    => $sent,
                    'failed'  => $failed,
                    'summary' => "weekly report: sent to {$sent} of " . count($recipients),
                ], JSON_UNESCAPED_UNICODE),
            ]);
        } catch (Throwable $e) {
            error_log('weekly report state: ' . $e->getMessage());
        }
        return ['sent' => $sent, 'failed' => $failed];
    }

    /** @return array{at: string, date: string, sent: int, failed: list<array>}|null */
    public static function lastSent(PDO $pdo): ?array
    {
        try {
            $stmt = $pdo->prepare('SELECT value FROM app_settings WHERE setting_key = :key');
            $stmt->execute(['key' => self::STATE_KEY]);
            $value = json_decode((string) $stmt->fetchColumn(), true);
            return is_array($value) && isset($value['date']) ? $value : null;
        } catch (Throwable $e) {
            return null;
        }
    }

    /**
     * The numbers, and the email built from them.
     *
     * @return array{subject: string, text: string, data: array<string, mixed>}
     */
    public static function build(PDO $pdo): array
    {
        $to = time();
        $from = $to - 7 * 86400;
        $before = $from - 7 * 86400;
        $d = static fn (int $t): string => date('Y-m-d H:i:s', $t);

        // Sign-ups by role, this week and the one before.
        $signups = ['club' => 0, 'trainer' => 0, 'athlete' => 0, 'none' => 0];
        $stmt = $pdo->prepare('SELECT account_type, COUNT(*) AS n FROM profiles WHERE created_at >= :from GROUP BY account_type');
        $stmt->execute(['from' => $d($from)]);
        foreach ($stmt->fetchAll() as $row) {
            $signups[$row['account_type'] ?? 'none'] = (int) $row['n'];
        }
        $previous = self::count($pdo, 'SELECT COUNT(*) FROM profiles WHERE created_at >= :a AND created_at < :b', ['a' => $d($before), 'b' => $d($from)]);

        $active = Database::hasTable('daily_active')
            ? self::count($pdo, 'SELECT COUNT(DISTINCT user_id) FROM daily_active WHERE day >= :a', ['a' => date('Y-m-d', $from)])
            : null;

        // Money approved this week (when it counts as received), clubs and trainers.
        $revenue = ['clubs' => [0, 0], 'trainers' => [0, 0]];
        $stmt = $pdo->prepare(
            "SELECT COUNT(*) AS n, COALESCE(SUM(amount_toman), 0) AS total FROM payment_requests
             WHERE status = 'approved' AND COALESCE(reviewed_at, created_at) >= :from"
        );
        $stmt->execute(['from' => $d($from)]);
        $row = $stmt->fetch();
        $revenue['clubs'] = [(int) $row['n'], (int) $row['total']];
        $pending = self::count($pdo, "SELECT COUNT(*) FROM payment_requests WHERE status = 'pending'");
        if (Database::hasTable('trainer_payment_requests')) {
            $stmt = $pdo->prepare(
                "SELECT COUNT(*) AS n, COALESCE(SUM(amount_toman), 0) AS total FROM trainer_payment_requests
                 WHERE status = 'approved' AND COALESCE(reviewed_at, created_at) >= :from"
            );
            $stmt->execute(['from' => $d($from)]);
            $row = $stmt->fetch();
            $revenue['trainers'] = [(int) $row['n'], (int) $row['total']];
            $pending += self::count($pdo, "SELECT COUNT(*) FROM trainer_payment_requests WHERE status = 'pending'");
        }

        $tickets = null;
        if (Database::hasTable('support_tickets')) {
            $tickets = [
                'new'  => self::count($pdo, 'SELECT COUNT(*) FROM support_tickets WHERE created_at >= :a', ['a' => $d($from)]),
                'open' => self::count($pdo, "SELECT COUNT(*) FROM support_tickets WHERE status <> 'closed'"),
            ];
        }

        // Subscriptions ending in the coming week.
        $expiring = [];
        $stmt = $pdo->prepare(
            'SELECT c.name, s.expires_at FROM clubs c
             JOIN subscriptions s ON s.club_id = c.id
               AND s.expires_at = (SELECT MAX(s2.expires_at) FROM subscriptions s2 WHERE s2.club_id = c.id)
             WHERE s.expires_at BETWEEN :now AND :soon ORDER BY s.expires_at'
        );
        $stmt->execute(['now' => $d($to), 'soon' => $d($to + 7 * 86400)]);
        foreach ($stmt->fetchAll() as $row) {
            $expiring[] = ['who' => 'باشگاه ' . $row['name'], 'expires_at' => $row['expires_at']];
        }
        if (Database::hasTable('trainer_subscriptions')) {
            $stmt = $pdo->prepare(
                "SELECT CONCAT_WS(' ', p.first_name, p.last_name) AS name, s.expires_at FROM trainer_subscriptions s
                 JOIN profiles p ON p.id = s.trainer_id
                 WHERE s.expires_at BETWEEN :now AND :soon ORDER BY s.expires_at"
            );
            $stmt->execute(['now' => $d($to), 'soon' => $d($to + 7 * 86400)]);
            foreach ($stmt->fetchAll() as $row) {
                $expiring[] = ['who' => 'مربی ' . trim((string) $row['name']), 'expires_at' => $row['expires_at']];
            }
        }

        $errors = ErrorLog::ready()
            ? self::count($pdo, 'SELECT COUNT(*) FROM error_logs WHERE resolved_at IS NULL AND last_seen >= :a', ['a' => $d($from)])
            : null;
        $verifications = TrainerVerification::ready()
            ? self::count($pdo, "SELECT COUNT(*) FROM trainer_profiles WHERE verification_status = 'pending'")
            : null;

        $data = compact('signups', 'previous', 'active', 'revenue', 'pending', 'tickets', 'expiring', 'errors', 'verifications');
        $site = Settings::get('branding')['app_name'] ?: 'جیم‌لیک';
        $range = Jalali::format($d($from), true) . ' تا ' . Jalali::format($d($to), true);

        return [
            'subject' => "گزارش هفتگی {$site} ({$range})",
            'text'    => self::text($site, $range, $data),
            'data'    => $data,
        ];
    }

    private static function text(string $site, string $range, array $data): string
    {
        $n = static fn (int $value): string => self::digits(number_format($value));
        $total = array_sum($data['signups']);
        $lines = [
            "گزارش هفتگی {$site}",
            $range,
            '',
            '— ثبت‌نام‌ها —',
            'ثبت‌نام تازه: ' . $n($total) . ' (هفتهٔ قبل: ' . $n($data['previous']) . ')',
            '  باشگاه ' . $n($data['signups']['club']) . ' · مربی ' . $n($data['signups']['trainer'])
                . ' · ورزشکار ' . $n($data['signups']['athlete']) . ' · بدون نقش ' . $n($data['signups']['none']),
        ];
        if ($data['active'] !== null) {
            $lines[] = 'کاربران فعال این هفته: ' . $n($data['active']);
        }

        [$clubCount, $clubTotal] = $data['revenue']['clubs'];
        [$trainerCount, $trainerTotal] = $data['revenue']['trainers'];
        array_push(
            $lines,
            '',
            '— درآمد (پرداخت‌های تأییدشده) —',
            'جمع: ' . $n($clubTotal + $trainerTotal) . ' تومان',
            '  اشتراک باشگاه‌ها: ' . $n($clubTotal) . ' تومان (' . $n($clubCount) . ' پرداخت)',
            '  اشتراک مربی‌ها: ' . $n($trainerTotal) . ' تومان (' . $n($trainerCount) . ' پرداخت)',
            'درخواست پرداختِ در انتظار تأیید: ' . $n($data['pending'])
        );

        if ($data['tickets'] !== null) {
            array_push(
                $lines,
                '',
                '— پشتیبانی —',
                'تیکت تازه: ' . $n($data['tickets']['new']) . ' · تیکت باز: ' . $n($data['tickets']['open'])
            );
        }

        $lines[] = '';
        $lines[] = '— اشتراک‌هایی که تا هفتهٔ آینده تمام می‌شوند —';
        if ($data['expiring'] === []) {
            $lines[] = 'هیچ‌کدام.';
        }
        foreach (array_slice($data['expiring'], 0, 30) as $item) {
            $lines[] = '  ' . $item['who'] . ': ' . Jalali::format($item['expires_at'], true);
        }
        if (count($data['expiring']) > 30) {
            $lines[] = '  و ' . $n(count($data['expiring']) - 30) . ' مورد دیگر';
        }

        $extra = [];
        if ($data['errors'] !== null && $data['errors'] > 0) {
            $extra[] = 'خطای باز در این هفته: ' . $n($data['errors']) . ' (پنل ← خطاهای سایت)';
        }
        if ($data['verifications'] !== null && $data['verifications'] > 0) {
            $extra[] = 'مدارک مربیِ در انتظار تأیید: ' . $n($data['verifications']);
        }
        if ($extra !== []) {
            $lines[] = '';
            $lines[] = '— کارهای مانده —';
            array_push($lines, ...$extra);
        }

        $lines[] = '';
        $lines[] = 'این ایمیل هر شنبه خودکار فرستاده می‌شود. گیرنده‌ها و خاموش‌کردنش: پنل مدیریت ← آمار رشد و استفاده ← گزارش هفتگی.';
        return implode("\n", $lines);
    }

    private static function count(PDO $pdo, string $sql, array $bind = []): int
    {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($bind);
        return (int) $stmt->fetchColumn();
    }

    private static function digits(string $value): string
    {
        return strtr($value, ['0' => '۰', '1' => '۱', '2' => '۲', '3' => '۳', '4' => '۴', '5' => '۵', '6' => '۶', '7' => '۷', '8' => '۸', '9' => '۹', ',' => '٬']);
    }
}
