<?php
declare(strict_types=1);

namespace Gymlic;

use Throwable;

/**
 * Each cron script records when it last finished and what it did, so
 * /admin/system can show a cron that has stopped running — on shared hosting
 * nothing else would notice. Stored as `cron.<name>` rows in app_settings
 * (outside Settings::KEYS, so Settings ignores them).
 *
 * The expected interval of each script lives here too: a run older than a
 * few intervals is shown as stalled.
 */
final class CronHeartbeat
{
    /** name => [label, expected minutes between runs] */
    public const JOBS = [
        'notification-dispatch' => ['ارسال پیامک و ایمیل اعلان‌ها', 5],
        'calendar-reminders'    => ['یادآور تقویم، مکمل‌ها و اعلان مرورگر', 5],
        'assessment-reminders'  => ['یادآور ارزیابی دوره‌ای', 1440],
        'receipt-cleanup'       => ['حذف رسیدهای پرداختِ قدیمی', 1440],
        'trainer-subscription-reminders' => ['یادآور پایان اشتراک مربیان', 1440],
    ];

    private function __construct()
    {
    }

    /** Never throws: a cron must not fail because its heartbeat could not be stored. */
    public static function record(string $name, string $summary): void
    {
        try {
            Database::connection()->prepare(
                'INSERT INTO app_settings (setting_key, value) VALUES (:key, :value)
                 ON DUPLICATE KEY UPDATE value = VALUES(value)'
            )->execute([
                'key'   => 'cron.' . $name,
                'value' => json_encode(['at' => date('Y-m-d H:i:s'), 'summary' => mb_substr($summary, 0, 300)], JSON_UNESCAPED_UNICODE),
            ]);
        } catch (Throwable $e) {
            error_log("cron heartbeat {$name}: " . $e->getMessage());
        }
    }

    /**
     * minutes_ago is worked out here, on the clock that wrote last_run_at:
     * the browser's clock and timezone may not match the host's.
     *
     * @return list<array{name: string, label: string, interval_minutes: int, last_run_at: ?string, minutes_ago: ?int, summary: ?string, state: string}>
     */
    public static function status(): array
    {
        $rows = [];
        try {
            $stmt = Database::connection()->query("SELECT setting_key, value FROM app_settings WHERE setting_key LIKE 'cron.%'");
            foreach ($stmt->fetchAll() as $row) {
                $rows[substr($row['setting_key'], 5)] = json_decode((string) $row['value'], true) ?: [];
            }
        } catch (Throwable $e) {
            // app_settings not created yet: every job reads as "never reported".
        }

        $out = [];
        foreach (self::JOBS as $name => [$label, $interval]) {
            $at = $rows[$name]['at'] ?? null;
            $age = $at !== null ? (time() - (int) strtotime($at)) / 60 : null;
            $out[] = [
                'name'             => $name,
                'label'            => $label,
                'interval_minutes' => $interval,
                'last_run_at'      => $at,
                'minutes_ago'      => $age !== null ? max(0, (int) floor($age)) : null,
                'summary'          => $rows[$name]['summary'] ?? null,
                // Three missed runs (and at least 20 minutes) before calling it stalled.
                'state'            => $age === null ? 'never' : ($age > max(20, $interval * 3) ? 'stalled' : 'ok'),
            ];
        }
        return $out;
    }
}
