<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\AdminAccess;
use Gymlic\Auth;
use Gymlic\Cast;
use Gymlic\Database;
use Gymlic\Features;
use Gymlic\Response;
use Gymlic\Settings;
use PDO;

/**
 * GET /admin/stats: the growth dashboard. Sign-ups by day and week, active
 * users (daily_active once phase 9's SQL has run; until then what
 * profiles.last_seen_at can tell), trainers and clubs who stopped coming,
 * subscriptions running out, and which panel sections are actually used.
 *
 * Days and weeks are the database's calendar days; weeks start on Saturday.
 */
final class AdminStatsController
{
    private const DAYS = 30;

    private const WEEKS = 12;

    private const INACTIVE_LIST_LIMIT = 50;

    /**
     * What counts as using a section: one row in its table, by its actor,
     * dated by its date column. feature: the switch it belongs to (null for
     * what can't be switched off). A table that isn't there yet is skipped.
     *
     * @var list<array{key: string, label: string, feature: ?string, table: string, actor: string, at: string, where?: string}>
     */
    private const USAGE = [
        ['key' => 'workout_plans', 'label' => 'برنامهٔ تمرینی', 'feature' => null, 'table' => 'workout_assignments', 'actor' => 'trainer_id', 'at' => 'assigned_at', 'where' => 'is_template = 0'],
        ['key' => 'workout_logs', 'label' => 'ثبت تمرین ورزشکار', 'feature' => null, 'table' => 'workout_day_logs', 'actor' => 'athlete_id', 'at' => 'created_at'],
        ['key' => 'nutrition', 'label' => 'برنامهٔ غذایی', 'feature' => 'nutrition', 'table' => 'nutrition_assignments', 'actor' => 'trainer_id', 'at' => 'assigned_at', 'where' => 'is_template = 0'],
        ['key' => 'templates', 'label' => 'قالب‌های برنامه', 'feature' => 'templates', 'table' => 'workout_assignments', 'actor' => 'trainer_id', 'at' => 'assigned_at', 'where' => 'is_template = 1'],
        ['key' => 'supplements', 'label' => 'برنامهٔ مکمل', 'feature' => 'supplements', 'table' => 'supplement_assignments', 'actor' => 'trainer_id', 'at' => 'created_at'],
        ['key' => 'messages', 'label' => 'پیام‌ها', 'feature' => 'messages', 'table' => 'messages', 'actor' => 'sender_id', 'at' => 'created_at'],
        ['key' => 'tickets', 'label' => 'تیکت‌های ورزشکار', 'feature' => 'tickets', 'table' => 'tickets', 'actor' => 'athlete_id', 'at' => 'created_at'],
        ['key' => 'questionnaires', 'label' => 'پرسشنامه (پاسخ‌ها)', 'feature' => 'questionnaires', 'table' => 'questionnaire_responses', 'actor' => 'athlete_id', 'at' => 'created_at'],
        ['key' => 'progress', 'label' => 'اندازه‌گیری‌ها', 'feature' => 'progress', 'table' => 'measurements', 'actor' => 'COALESCE(recorded_by, athlete_id)', 'at' => 'recorded_at'],
        ['key' => 'session_packages', 'label' => 'جلسات خصوصی', 'feature' => 'session_packages', 'table' => 'session_packages', 'actor' => 'trainer_id', 'at' => 'created_at'],
        ['key' => 'invoices', 'label' => 'صورتحساب ورزشکار', 'feature' => null, 'table' => 'invoices', 'actor' => 'trainer_id', 'at' => 'created_at'],
        ['key' => 'earnings', 'label' => 'درآمد مربی', 'feature' => 'earnings', 'table' => 'trainer_payments', 'actor' => 'trainer_id', 'at' => 'created_at'],
        ['key' => 'notes', 'label' => 'یادداشت‌های مربی', 'feature' => 'notes', 'table' => 'notes', 'actor' => 'trainer_id', 'at' => 'created_at'],
        ['key' => 'calendar', 'label' => 'تقویم', 'feature' => 'calendar', 'table' => 'calendar_events', 'actor' => 'trainer_id', 'at' => 'created_at'],
        ['key' => 'club_finance', 'label' => 'امور مالی باشگاه', 'feature' => 'club_finance', 'table' => 'revenue_entries', 'actor' => 'club_id', 'at' => 'created_at'],
        ['key' => 'attendance', 'label' => 'حضور و غیاب باشگاه', 'feature' => null, 'table' => 'class_attendance_logs', 'actor' => 'club_id', 'at' => 'created_at'],
        ['key' => 'support', 'label' => 'تیکت پشتیبانی', 'feature' => 'support', 'table' => 'support_tickets', 'actor' => 'user_id', 'at' => 'created_at'],
    ];

    public static function overview(): void
    {
        $admin = Auth::requireAdmin('users.view');
        $pdo = Database::connection();
        $inactiveDays = max(7, min(180, (int) ($_GET['inactive_days'] ?? 14)));

        $today = self::scalar($pdo, 'SELECT CURDATE()');
        // The Saturday that starts this week, and the first of the WEEKS weeks shown.
        $weekStart = date('Y-m-d', strtotime($today . ' -' . (((int) date('w', strtotime($today)) + 1) % 7) . ' days'));
        $firstWeek = date('Y-m-d', strtotime($weekStart . ' -' . (self::WEEKS - 1) . ' weeks'));
        $firstDay = date('Y-m-d', strtotime($today . ' -' . (self::DAYS - 1) . ' days'));

        Response::ok([
            'today'         => $today,
            'totals'        => self::totals($pdo),
            'signups'       => self::signups($pdo, $today, $firstDay, $weekStart, $firstWeek),
            'active'        => self::active($pdo, $today, $firstDay, $weekStart, $firstWeek),
            'inactive'      => self::inactive($pdo, $inactiveDays),
            'subscriptions' => AdminAccess::can($admin, 'finance') ? self::subscriptions($pdo) : null,
            'usage'         => self::usage($pdo),
        ]);
    }

    /** Accounts by role ('none' = signed up, never picked one). */
    private static function totals(PDO $pdo): array
    {
        $out = ['all' => 0, 'club' => 0, 'trainer' => 0, 'athlete' => 0, 'none' => 0];
        foreach ($pdo->query('SELECT account_type, COUNT(*) AS n FROM profiles GROUP BY account_type')->fetchAll() as $row) {
            $out[$row['account_type'] ?? 'none'] = (int) $row['n'];
            $out['all'] += (int) $row['n'];
        }
        return $out;
    }

    private static function signups(PDO $pdo, string $today, string $firstDay, string $weekStart, string $firstWeek): array
    {
        $stmt = $pdo->prepare(
            'SELECT DATE(created_at) AS day, account_type, COUNT(*) AS n FROM profiles
             WHERE created_at >= :since GROUP BY day, account_type'
        );
        $stmt->execute(['since' => $firstWeek]);

        $daily = self::emptyDays($today, $firstDay, ['club' => 0, 'trainer' => 0, 'athlete' => 0, 'none' => 0]);
        $weekly = self::emptyWeeks($weekStart, $firstWeek, ['club' => 0, 'trainer' => 0, 'athlete' => 0, 'none' => 0]);
        foreach ($stmt->fetchAll() as $row) {
            $role = $row['account_type'] ?? 'none';
            $n = (int) $row['n'];
            if (isset($daily[$row['day']])) {
                $daily[$row['day']][$role] += $n;
            }
            $week = self::weekOf((string) $row['day'], $firstWeek);
            if (isset($weekly[$week])) {
                $weekly[$week][$role] += $n;
            }
        }

        $weeklyList = array_values($weekly);
        $sum = static fn (array $row): int => $row['club'] + $row['trainer'] + $row['athlete'] + $row['none'];
        return [
            'daily'     => array_values($daily),
            'weekly'    => $weeklyList,
            'this_week' => $sum($weeklyList[count($weeklyList) - 1]),
            'last_week' => $sum($weeklyList[count($weeklyList) - 2]),
        ];
    }

    /**
     * Active = used the panel that day. With daily_active: per day and per
     * week. Without it yet, only the headline counts, from last_seen_at.
     */
    private static function active(PDO $pdo, string $today, string $firstDay, string $weekStart, string $firstWeek): array
    {
        if (!Database::hasTable('daily_active')) {
            $since = static function (PDO $pdo, string $from): int {
                $stmt = $pdo->prepare('SELECT COUNT(*) FROM profiles WHERE last_seen_at >= :from');
                $stmt->execute(['from' => $from]);
                return (int) $stmt->fetchColumn();
            };
            $hasSeen = Database::hasColumn('profiles', 'last_seen_at');
            return [
                'source' => $hasSeen ? 'last_seen' : 'none',
                'today'  => $hasSeen ? $since($pdo, $today) : 0,
                'week'   => $hasSeen ? $since($pdo, date('Y-m-d', strtotime($today . ' -6 days'))) : 0,
                'month'  => $hasSeen ? $since($pdo, $firstDay) : 0,
                'daily'  => [],
                'weekly' => [],
            ];
        }

        $distinctSince = static function (PDO $pdo, string $from): int {
            $stmt = $pdo->prepare('SELECT COUNT(DISTINCT user_id) FROM daily_active WHERE day >= :from');
            $stmt->execute(['from' => $from]);
            return (int) $stmt->fetchColumn();
        };

        $daily = self::emptyDays($today, $firstDay, ['count' => 0]);
        $stmt = $pdo->prepare('SELECT day, COUNT(*) AS n FROM daily_active WHERE day >= :from GROUP BY day');
        $stmt->execute(['from' => $firstDay]);
        foreach ($stmt->fetchAll() as $row) {
            if (isset($daily[$row['day']])) {
                $daily[$row['day']]['count'] = (int) $row['n'];
            }
        }

        $weekly = self::emptyWeeks($weekStart, $firstWeek, ['count' => 0]);
        $stmt = $pdo->prepare(
            'SELECT FLOOR(DATEDIFF(day, :start1) / 7) AS w, COUNT(DISTINCT user_id) AS n
             FROM daily_active WHERE day >= :start2 GROUP BY w'
        );
        $stmt->execute(['start1' => $firstWeek, 'start2' => $firstWeek]);
        $weekKeys = array_keys($weekly);
        foreach ($stmt->fetchAll() as $row) {
            $key = $weekKeys[(int) $row['w']] ?? null;
            if ($key !== null) {
                $weekly[$key]['count'] = (int) $row['n'];
            }
        }

        return [
            'source' => 'daily_active',
            'today'  => $daily[$today]['count'] ?? 0,
            'week'   => $distinctSince($pdo, date('Y-m-d', strtotime($today . ' -6 days'))),
            'month'  => $distinctSince($pdo, $firstDay),
            'daily'  => array_values($daily),
            'weekly' => array_values($weekly),
        ];
    }

    /**
     * Trainers and club owners who haven't used the panel in $days days,
     * the ones who went quiet most recently first (the likeliest to come
     * back with a nudge). Never-seen accounts count from their sign-up.
     */
    private static function inactive(PDO $pdo, int $days): array
    {
        $own = Database::hasColumn('sessions', 'impersonated_by') ? ' AND s.impersonated_by IS NULL' : '';
        $seen = Database::hasColumn('profiles', 'last_seen_at')
            ? "COALESCE(p.last_seen_at, (SELECT MAX(s.created_at) FROM sessions s WHERE s.user_id = p.id{$own}), p.created_at)"
            : "COALESCE((SELECT MAX(s.created_at) FROM sessions s WHERE s.user_id = p.id{$own}), p.created_at)";
        $cutoff = date('Y-m-d H:i:s', time() - $days * 86400);

        $out = ['days' => $days];
        foreach (['trainer' => 'trainers', 'club' => 'clubs'] as $role => $key) {
            $extra = $role === 'trainer'
                ? "(SELECT COUNT(*) FROM trainer_athletes ta WHERE ta.trainer_id = p.id AND ta.status = 'active') AS athletes,
                   NULL AS club_id, NULL AS club_name"
                : 'NULL AS athletes,
                   (SELECT c.id FROM clubs c WHERE c.owner_id = p.id ORDER BY c.created_at LIMIT 1) AS club_id,
                   (SELECT c.name FROM clubs c WHERE c.owner_id = p.id ORDER BY c.created_at LIMIT 1) AS club_name';
            $stmt = $pdo->prepare(
                "SELECT * FROM (
                   SELECT p.id, p.first_name, p.last_name, p.email, p.phone, p.created_at,
                          {$seen} AS last_seen_at, {$extra}
                   FROM profiles p
                   WHERE p.account_type = :role AND p.is_suspended = 0
                 ) x WHERE x.last_seen_at < :cutoff
                 ORDER BY x.last_seen_at DESC"
            );
            $stmt->execute(['role' => $role, 'cutoff' => $cutoff]);
            $rows = $stmt->fetchAll();
            $out[$key] = [
                'count' => count($rows),
                'items' => Cast::rows(array_slice($rows, 0, self::INACTIVE_LIST_LIMIT), [], ['athletes']),
            ];
        }
        return $out;
    }

    /**
     * Clubs whose latest subscription runs out within the admin's "expiring"
     * window, and those that ran out in the last 30 days without a renewal.
     */
    private static function subscriptions(PDO $pdo): array
    {
        $days = Settings::get('billing')['expiring_days'];
        $stmt = $pdo->prepare(
            'SELECT c.id AS club_id, c.name AS club_name, s.plan_name, s.expires_at,
                    CONCAT_WS(\' \', o.first_name, o.last_name) AS owner_name, o.phone AS owner_phone
             FROM clubs c
             JOIN subscriptions s ON s.club_id = c.id
               AND s.expires_at = (SELECT MAX(s2.expires_at) FROM subscriptions s2 WHERE s2.club_id = c.id)
             LEFT JOIN profiles o ON o.id = c.owner_id
             WHERE s.expires_at BETWEEN :from AND :to
             ORDER BY s.expires_at ASC'
        );
        $stmt->execute([
            'from' => date('Y-m-d H:i:s', time() - 30 * 86400),
            'to'   => date('Y-m-d H:i:s', time() + $days * 86400),
        ]);

        $expiring = [];
        $expired = [];
        foreach ($stmt->fetchAll() as $row) {
            $left = strtotime((string) $row['expires_at']) - time();
            $row['days_left'] = $left > 0 ? (int) ceil($left / 86400) : 0;
            if ($left > 0) {
                $expiring[] = $row;
            } else {
                $expired[] = $row;
            }
        }
        // Most recently lapsed first.
        $expired = array_reverse($expired);

        return ['expiring_days' => $days, 'expiring' => $expiring, 'expired' => $expired];
    }

    /** Each section: rows and distinct people in the last 30 days, and the 30 before. */
    private static function usage(PDO $pdo): array
    {
        $now = time();
        $from = date('Y-m-d H:i:s', $now - 30 * 86400);
        $before = date('Y-m-d H:i:s', $now - 60 * 86400);

        $out = [];
        foreach (self::USAGE as $section) {
            if (!Database::hasTable($section['table'])) {
                continue;
            }
            $where = isset($section['where']) ? " AND {$section['where']}" : '';
            $stmt = $pdo->prepare(
                "SELECT
                   SUM({$section['at']} >= :from1) AS actions,
                   COUNT(DISTINCT CASE WHEN {$section['at']} >= :from2 THEN {$section['actor']} END) AS actors,
                   SUM({$section['at']} < :from3) AS prev_actions,
                   COUNT(DISTINCT CASE WHEN {$section['at']} < :from4 THEN {$section['actor']} END) AS prev_actors
                 FROM {$section['table']}
                 WHERE {$section['at']} >= :before{$where}"
            );
            $stmt->execute(['from1' => $from, 'from2' => $from, 'from3' => $from, 'from4' => $from, 'before' => $before]);
            $row = $stmt->fetch();

            $feature = $section['feature'];
            $out[] = [
                'key'          => $section['key'],
                'label'        => $section['label'],
                'feature'      => $feature,
                'enabled'      => $feature === null || !isset(Features::CATALOG[$feature]) || Features::fullyEnabled($feature),
                'actions'      => (int) ($row['actions'] ?? 0),
                'actors'       => (int) ($row['actors'] ?? 0),
                'prev_actions' => (int) ($row['prev_actions'] ?? 0),
                'prev_actors'  => (int) ($row['prev_actors'] ?? 0),
            ];
        }

        usort($out, static fn (array $a, array $b): int => [$b['actors'], $b['actions']] <=> [$a['actors'], $a['actions']]);
        return $out;
    }

    /** @return array<string, array<string, mixed>> keyed by date, oldest first */
    private static function emptyDays(string $today, string $firstDay, array $fields): array
    {
        $out = [];
        for ($t = strtotime($firstDay); $t <= strtotime($today); $t = strtotime('+1 day', $t)) {
            $day = date('Y-m-d', $t);
            $out[$day] = ['date' => $day] + $fields;
        }
        return $out;
    }

    /** @return array<string, array<string, mixed>> keyed by the week's Saturday, oldest first */
    private static function emptyWeeks(string $weekStart, string $firstWeek, array $fields): array
    {
        $out = [];
        for ($t = strtotime($firstWeek); $t <= strtotime($weekStart); $t = strtotime('+1 week', $t)) {
            $day = date('Y-m-d', $t);
            $out[$day] = ['start' => $day] + $fields;
        }
        return $out;
    }

    /** The Saturday starting $day's week, counted in whole weeks from $firstWeek. */
    private static function weekOf(string $day, string $firstWeek): string
    {
        $weeks = intdiv((int) round((strtotime($day) - strtotime($firstWeek)) / 86400), 7);
        return date('Y-m-d', strtotime($firstWeek . ' +' . $weeks . ' weeks'));
    }

    private static function scalar(PDO $pdo, string $sql): string
    {
        return (string) $pdo->query($sql)->fetchColumn();
    }
}
