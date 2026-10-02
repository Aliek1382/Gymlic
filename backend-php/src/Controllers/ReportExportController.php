<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\Jalali;
use Gymlic\Limits;
use Gymlic\Response;
use Gymlic\TrainingWeek;
use Gymlic\Xlsx;
use PDO;

/**
 * «خروجی اکسل» of the reports page (phase 4): the full report sections as an
 * .xlsx, one sheet each: monthly stats (12 Jalali months), completion rates
 * (overall and per athlete), weekly adherence (this week, the streak and the
 * last 8 weeks per athlete). Only for report level full_excel. Only the
 * trainer's own plans and athletes; in a club, still only their own.
 *
 * Not the full export of the trainer's data (phase 5, open to every plan):
 * that is a separate endpoint and must stay one.
 */
final class ReportExportController
{
    private const MONTHS = 12;

    private const WEEKS = 8;

    /** How far back the streak looks, as the panel's (STREAK_WEEKS). */
    private const STREAK_WEEKS = 12;

    public static function excel(): void
    {
        $user = Auth::requireUser();
        if ($user['account_type'] !== 'trainer') {
            Response::error(403, 'forbidden', 'این خروجی فقط برای مربی است.');
            return;
        }
        Limits::requireReport($user, 'full_excel', 'خروجی اکسل', 'دریافت');

        $pdo = Database::connection();
        $trainerId = $user['id'];
        $athletes = self::athletes($pdo, $trainerId);

        // Every query below runs before the first byte goes out, so an
        // error still reaches the trainer as a message, not a broken file.
        $sheets = [
            ['آمار ماهانه', self::monthly($pdo, $trainerId), [16, 16, 16, 16]],
            ['نرخ تکمیل', self::completion($pdo, $trainerId, $athletes), [24, 14, 12, 18, 14, 12, 18]],
            ['پایبندی هفتگی', self::adherence($pdo, $trainerId, $athletes), array_merge([24, 26, 14, 16, 18, 16], array_fill(0, self::WEEKS, 16))],
        ];

        AdminController::logActivity($pdo, null, $trainerId, $trainerId, 'report_excel_export', [
            'athletes' => count($athletes),
        ]);

        self::sendHeaders('gymlic-report-' . str_replace('/', '-', Jalali::format(TrainingWeek::today())) . '.xlsx');
        $xlsx = new Xlsx(static function (string $bytes): void {
            echo $bytes;
        });
        foreach ($sheets as [$name, $rows, $widths]) {
            $xlsx->sheet($name, $rows, $widths);
        }
        $xlsx->finish();
    }

    /** The download's headers, before the file streams out. Shared with the full data export. */
    public static function sendHeaders(string $fileName): void
    {
        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment; filename="' . $fileName . '"');
        header('Cache-Control: no-store');
        // The site is on another origin; this lets it read the file name.
        header('Access-Control-Expose-Headers: Content-Disposition');
    }

    /** @return array<string, string> the trainer's active athletes, id => name */
    private static function athletes(PDO $pdo, string $trainerId): array
    {
        $stmt = $pdo->prepare(
            "SELECT ta.athlete_id, p.first_name, p.last_name
             FROM trainer_athletes ta JOIN profiles p ON p.id = ta.athlete_id
             WHERE ta.trainer_id = :t AND ta.status = 'active'
             ORDER BY ta.created_at DESC"
        );
        $stmt->execute(['t' => $trainerId]);
        $out = [];
        foreach ($stmt->fetchAll() as $row) {
            $name = trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''));
            $out[$row['athlete_id']] = $name !== '' ? $name : 'بی‌نام';
        }
        return $out;
    }

    /**
     * Plans sent (not drafts or templates) and athletes added, per Jalali
     * month, newest first. Every plan counts, whatever the history limit
     * hides from the trainer's lists.
     *
     * @return list<list<string|int>>
     */
    private static function monthly(PDO $pdo, string $trainerId): array
    {
        $starts = [Jalali::monthStart()];
        for ($i = 1; $i < self::MONTHS; $i++) {
            $starts[] = Jalali::monthStart(date('Y-m-d', (int) strtotime($starts[$i - 1] . ' -1 day')));
        }
        $from = end($starts) . ' 00:00:00';

        $counts = array_fill_keys($starts, ['workout' => 0, 'nutrition' => 0, 'athletes' => 0]);
        $bucket = static function (string $at) use ($starts): ?string {
            foreach ($starts as $start) {
                if (substr($at, 0, 10) >= $start) {
                    return $start;
                }
            }
            return null;
        };

        $sources = [
            'workout'   => "SELECT assigned_at FROM workout_assignments WHERE trainer_id = :t AND is_template = 0 AND status <> 'draft' AND assigned_at >= :f",
            'nutrition' => "SELECT assigned_at FROM nutrition_assignments WHERE trainer_id = :t AND is_template = 0 AND status <> 'draft' AND assigned_at >= :f",
            'athletes'  => 'SELECT created_at FROM trainer_athletes WHERE trainer_id = :t AND created_at >= :f',
        ];
        foreach ($sources as $key => $sql) {
            $stmt = $pdo->prepare($sql);
            $stmt->execute(['t' => $trainerId, 'f' => $from]);
            foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $at) {
                $month = $bucket((string) $at);
                if ($month !== null) {
                    $counts[$month][$key]++;
                }
            }
        }

        $rows = [['ماه', 'برنامه‌ی تمرینی', 'برنامه‌ی غذایی', 'ورزشکار تازه']];
        foreach ($counts as $start => $c) {
            $rows[] = [Jalali::monthLabel($start), $c['workout'], $c['nutrition'], $c['athletes']];
        }
        return $rows;
    }

    /**
     * Completed of sent plans: all of the trainer's first, then each active
     * athlete's.
     *
     * @param array<string, string> $athletes
     * @return list<list<string|int|null>>
     */
    private static function completion(PDO $pdo, string $trainerId, array $athletes): array
    {
        $per = [];
        foreach (['workout' => 'workout_assignments', 'nutrition' => 'nutrition_assignments'] as $kind => $table) {
            $stmt = $pdo->prepare(
                "SELECT athlete_id, SUM(status = 'completed') AS done, COUNT(*) AS total
                 FROM {$table} WHERE trainer_id = :t AND is_template = 0 AND status <> 'draft'
                 GROUP BY athlete_id"
            );
            $stmt->execute(['t' => $trainerId]);
            foreach ($stmt->fetchAll() as $row) {
                $per[(string) $row['athlete_id']][$kind] = [(int) $row['done'], (int) $row['total']];
            }
        }

        $line = static function (string $label, array $c): array {
            [$wd, $wt] = $c['workout'] ?? [0, 0];
            [$nd, $nt] = $c['nutrition'] ?? [0, 0];
            return [$label, $wd, $wt, self::rate($wd, $wt), $nd, $nt, self::rate($nd, $nt)];
        };

        $all = ['workout' => [0, 0], 'nutrition' => [0, 0]];
        foreach ($per as $c) {
            foreach (['workout', 'nutrition'] as $kind) {
                $all[$kind][0] += $c[$kind][0] ?? 0;
                $all[$kind][1] += $c[$kind][1] ?? 0;
            }
        }

        $rows = [
            ['ورزشکار', 'تمرینی تمام‌شده', 'کل تمرینی', 'نرخ تکمیل تمرینی (٪)', 'غذایی تمام‌شده', 'کل غذایی', 'نرخ تکمیل غذایی (٪)'],
            $line('همه‌ی برنامه‌ها', $all),
        ];
        foreach ($athletes as $id => $name) {
            $rows[] = $line($name, $per[$id] ?? []);
        }
        return $rows;
    }

    /**
     * Each active athlete against their current active workout plan, counted
     * as on the reports page (TrainingWeek): this week's ticked days of that
     * plan, the streak, and the distinct days trained in each of the last
     * weeks, newest first.
     *
     * @param array<string, string> $athletes
     * @return list<list<string|int|null>>
     */
    private static function adherence(PDO $pdo, string $trainerId, array $athletes): array
    {
        $plans = $pdo->prepare(
            "SELECT id, athlete_id, title, description FROM workout_assignments
             WHERE trainer_id = :t AND is_template = 0 AND status = 'active'
             ORDER BY assigned_at DESC"
        );
        $plans->execute(['t' => $trainerId]);
        $planOf = [];
        foreach ($plans->fetchAll() as $row) {
            $planOf[$row['athlete_id']] ??= $row;
        }

        $thisWeek = TrainingWeek::weekStart(TrainingWeek::today());
        $logs = $pdo->prepare(
            "SELECT l.athlete_id, l.assignment_id, l.day_key, l.completed_on
             FROM workout_day_logs l
             JOIN trainer_athletes ta ON ta.athlete_id = l.athlete_id AND ta.trainer_id = :t AND ta.status = 'active'
             WHERE l.completed_on >= :f"
        );
        $logs->execute(['t' => $trainerId, 'f' => TrainingWeek::shift($thisWeek, -(self::STREAK_WEEKS - 1))]);
        $dates = [];
        $doneDays = [];
        foreach ($logs->fetchAll() as $log) {
            $on = substr((string) $log['completed_on'], 0, 10);
            $dates[$log['athlete_id']][] = $on;
            if ($on >= $thisWeek) {
                $doneDays[$log['assignment_id']][$log['day_key']] = true;
            }
        }

        $weeks = [];
        for ($i = 0; $i < self::WEEKS; $i++) {
            $weeks[] = TrainingWeek::shift($thisWeek, -$i);
        }
        $header = ['ورزشکار', 'برنامه‌ی فعال', 'جلسه در هفته', 'انجام‌شده این هفته', 'پایبندی این هفته (٪)', 'هفته‌های پیاپی'];
        foreach ($weeks as $week) {
            $header[] = 'هفته ' . Jalali::format($week);
        }

        $rows = [$header];
        foreach ($athletes as $id => $name) {
            $plan = $planOf[$id] ?? null;
            $sessions = $plan !== null ? TrainingWeek::sessionsPerWeek($plan['description']) : 0;
            $done = $plan !== null ? count($doneDays[$plan['id']] ?? []) : 0;

            $perWeek = [];
            foreach (array_unique($dates[$id] ?? []) as $on) {
                $week = TrainingWeek::weekStart($on);
                $perWeek[$week] = ($perWeek[$week] ?? 0) + 1;
            }

            $row = [
                $name,
                $plan !== null ? (string) $plan['title'] : 'ندارد',
                $sessions,
                $done,
                $sessions > 0 ? (int) round(min($done, $sessions) / $sessions * 100) : null,
                TrainingWeek::streak($dates[$id] ?? []),
            ];
            foreach ($weeks as $week) {
                $row[] = $perWeek[$week] ?? 0;
            }
            $rows[] = $row;
        }
        return $rows;
    }

    private static function rate(int $done, int $total): ?int
    {
        return $total === 0 ? null : (int) round($done / $total * 100);
    }
}
