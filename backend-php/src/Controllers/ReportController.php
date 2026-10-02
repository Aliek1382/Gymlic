<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Acl;
use Gymlic\Auth;
use Gymlic\Cast;
use Gymlic\Database;
use Gymlic\Jalali;
use Gymlic\Limits;
use Gymlic\Response;

/**
 * Trainer-side analytics. All read-only. Each section needs a report level
 * of the trainer's plan (Limits::requireReport, phase 4): the athlete count
 * any; plans this month, completion rates and athlete progress basic;
 * weekly adherence full. The financial summary («درآمد من») is open to all.
 * Counts run over all of the trainer's plans, whatever the history limit
 * (phase 3) hides from their lists.
 */
final class ReportController
{
    /**
     * Whether the invoices table exists on the live database. Flip to true
     * once the invoice task's SQL has been run in phpMyAdmin; while false the
     * financial summary reads trainer_payments only. Deliberately a constant
     * here rather than a config.php key: the live config.php is never
     * overwritten by a deploy, so a new key would silently be missing there.
     */
    private const INVOICES_DEPLOYED = false;

    /**
     * The athlete count is open to every plan (report level count); the
     * plans made this (Jalali) month need level basic and are null below it,
     * with locked set, so the page shows the count beside a locked card.
     */
    public static function monthlyStats(): void
    {
        $user = Auth::requireUser();
        $pdo = Database::connection();
        $open = $user['account_type'] !== 'trainer' || !Limits::enforcing()
            || Limits::reportAllows(Limits::forTrainer($pdo, $user['id'])['reports']['effective'], 'basic');

        $athletes = $pdo->prepare("SELECT COUNT(*) FROM trainer_athletes WHERE trainer_id = :u AND status = 'active'");
        $athletes->execute(['u' => $user['id']]);
        $out = [
            'athletes_count'             => (int) $athletes->fetchColumn(),
            'workout_plans_this_month'   => null,
            'nutrition_plans_this_month' => null,
            'locked'                     => !$open,
        ];
        if (!$open) {
            Response::ok($out);
            return;
        }

        $monthStart = Jalali::monthStart() . ' 00:00:00';
        $stmt = $pdo->prepare(
            "SELECT
               (SELECT COUNT(*) FROM workout_assignments
                 WHERE trainer_id = :u2 AND is_template = 0 AND status <> 'draft'
                   AND assigned_at >= :m1) AS workout_plans_this_month,
               (SELECT COUNT(*) FROM nutrition_assignments
                 WHERE trainer_id = :u3 AND is_template = 0 AND status <> 'draft'
                   AND assigned_at >= :m2) AS nutrition_plans_this_month"
        );
        $stmt->execute([
            'u2' => $user['id'], 'u3' => $user['id'],
            'm1' => $monthStart, 'm2' => $monthStart,
        ]);

        Response::ok(array_merge($out, Cast::row($stmt->fetch(), [], [
            'workout_plans_this_month', 'nutrition_plans_this_month',
        ])));
    }

    /**
     * Money the trainer received, summed on the server per month (Gregorian
     * 'YYYY-MM') and payment method over from..to inclusive (YYYY-MM-DD).
     * Sources: the manual ledger (trainer_payments) and, when deployed, paid
     * invoices — which already cover session packages, so those are not
     * counted a second time. Read-only.
     */
    public static function financialSummary(): void
    {
        $user = Auth::requireUser();

        $from = (string) ($_GET['from'] ?? '');
        $to = (string) ($_GET['to'] ?? '');
        $fromTs = self::isoDate($from);
        $toTs = self::isoDate($to);
        if ($fromTs === null || $toTs === null || $fromTs > $toTs) {
            Response::error(400, 'invalid_range', 'from and to must be YYYY-MM-DD dates, from <= to.');
            return;
        }

        // invoices.paid_at is a DATETIME, so its upper bound is the start of
        // the day after `to`; trainer_payments.paid_at is a DATE.
        $toExclusive = date('Y-m-d', strtotime('+1 day', $toTs));

        $sql = "SELECT DATE_FORMAT(paid_at, '%Y-%m') AS month, payment_method,
                       SUM(amount_toman) AS total_toman, COUNT(*) AS cnt
                FROM trainer_payments
                WHERE trainer_id = :tp_trainer AND paid_at BETWEEN :tp_from AND :tp_to
                GROUP BY month, payment_method";
        $bind = ['tp_trainer' => $user['id'], 'tp_from' => $from, 'tp_to' => $to];

        if (self::INVOICES_DEPLOYED) {
            $sql .= " UNION ALL
                SELECT DATE_FORMAT(paid_at, '%Y-%m') AS month, payment_method,
                       SUM(amount_toman) AS total_toman, COUNT(*) AS cnt
                FROM invoices
                WHERE trainer_id = :inv_trainer AND status = 'paid'
                  AND payment_method IS NOT NULL
                  AND paid_at >= :inv_from AND paid_at < :inv_to
                GROUP BY month, payment_method";
            $bind += ['inv_trainer' => $user['id'], 'inv_from' => $from, 'inv_to' => $toExclusive];
        }

        $stmt = Database::connection()->prepare("SELECT month, payment_method, SUM(total_toman) AS total_toman, SUM(cnt) AS `count`
             FROM ({$sql}) AS t GROUP BY month, payment_method ORDER BY month DESC, payment_method");
        $stmt->execute($bind);

        Response::ok(['items' => Cast::rows($stmt->fetchAll(), [], ['total_toman', 'count'])]);
    }

    private static function isoDate(string $value): ?int
    {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return null;
        }
        $ts = strtotime($value);
        return ($ts === false || date('Y-m-d', $ts) !== $value) ? null : $ts;
    }

    /** Completed plan count per athlete on the trainer's roster. */
    public static function athleteProgress(): void
    {
        $user = Auth::requireUser();
        Limits::requireReport($user, 'basic', 'پیشرفت ورزشکاران');

        $stmt = Database::connection()->prepare(
            "SELECT ta.athlete_id, p.first_name, p.last_name,
                    (SELECT COUNT(*) FROM workout_assignments w
                      WHERE w.trainer_id = ta.trainer_id AND w.athlete_id = ta.athlete_id
                        AND w.status = 'completed')
                  + (SELECT COUNT(*) FROM nutrition_assignments n
                      WHERE n.trainer_id = ta.trainer_id AND n.athlete_id = ta.athlete_id
                        AND n.status = 'completed') AS completed_count
             FROM trainer_athletes ta
             JOIN profiles p ON p.id = ta.athlete_id
             WHERE ta.trainer_id = :trainer_id AND ta.status = 'active'
             ORDER BY ta.created_at DESC"
        );
        $stmt->execute(['trainer_id' => $user['id']]);

        Response::ok(['items' => Cast::rows($stmt->fetchAll(), [], ['completed_count'])]);
    }

    /**
     * The raw material for weekly adherence: each athlete's current active
     * plan and their ticks since `from`. A plan's training days are headings
     * inside its free-text description, and the client already parses those
     * for the athlete's own screen — returning the description keeps one
     * parser rather than a second one here that could drift from it.
     */
    public static function weeklyAdherence(): void
    {
        $user = Auth::requireUser();
        Limits::requireReport($user, 'full', 'پایبندی هفتگی');
        $from = $_GET['from'] ?? date('Y-m-d', strtotime('-7 days'));
        $pdo = Database::connection();

        // The whole roster, so an athlete with no active plan still appears
        // in the report (measured against zero sessions) rather than vanishing.
        $athletes = $pdo->prepare(
            "SELECT ta.athlete_id, p.first_name, p.last_name
             FROM trainer_athletes ta
             JOIN profiles p ON p.id = ta.athlete_id
             WHERE ta.trainer_id = :trainer_id AND ta.status = 'active'
             ORDER BY ta.created_at DESC"
        );
        $athletes->execute(['trainer_id' => $user['id']]);

        $plans = $pdo->prepare(
            "SELECT a.id, a.athlete_id, a.description, p.first_name, p.last_name
             FROM workout_assignments a
             JOIN profiles p ON p.id = a.athlete_id
             JOIN trainer_athletes ta
               ON ta.athlete_id = a.athlete_id AND ta.trainer_id = a.trainer_id AND ta.status = 'active'
             WHERE a.trainer_id = :trainer_id AND a.is_template = 0 AND a.status = 'active'
             ORDER BY a.assigned_at DESC"
        );
        $plans->execute(['trainer_id' => $user['id']]);

        // The athlete's own screen ticks against their most recent active
        // plan, so adherence is measured against that same one.
        $planByAthlete = [];
        foreach ($plans->fetchAll() as $row) {
            $planByAthlete[$row['athlete_id']] ??= $row;
        }

        $logs = $pdo->prepare(
            'SELECT l.athlete_id, l.assignment_id, l.day_key, l.completed_on
             FROM workout_day_logs l
             JOIN trainer_athletes ta
               ON ta.athlete_id = l.athlete_id AND ta.trainer_id = :trainer_id AND ta.status = \'active\'
             WHERE l.completed_on >= :from'
        );
        $logs->execute(['trainer_id' => $user['id'], 'from' => $from]);

        Response::ok([
            'athletes' => $athletes->fetchAll(),
            'plans'    => array_values($planByAthlete),
            'logs'     => $logs->fetchAll(),
        ]);
    }

    public static function completionRates(): void
    {
        $user = Auth::requireUser();
        Limits::requireReport($user, 'basic', 'نرخ تکمیل');

        $stmt = Database::connection()->prepare(
            "SELECT
               (SELECT COUNT(*) FROM workout_assignments
                 WHERE trainer_id = :u1 AND status = 'completed' AND is_template = 0) AS workout_completed,
               (SELECT COUNT(*) FROM workout_assignments
                 WHERE trainer_id = :u2 AND status <> 'draft' AND is_template = 0) AS workout_total,
               (SELECT COUNT(*) FROM nutrition_assignments
                 WHERE trainer_id = :u3 AND status = 'completed' AND is_template = 0) AS nutrition_completed,
               (SELECT COUNT(*) FROM nutrition_assignments
                 WHERE trainer_id = :u4 AND status <> 'draft' AND is_template = 0) AS nutrition_total"
        );
        $stmt->execute([
            'u1' => $user['id'], 'u2' => $user['id'], 'u3' => $user['id'], 'u4' => $user['id'],
        ]);
        $row = $stmt->fetch();

        Response::ok([
            'workout_completion_rate'   => self::rate((int) $row['workout_completed'], (int) $row['workout_total']),
            'nutrition_completion_rate' => self::rate((int) $row['nutrition_completed'], (int) $row['nutrition_total']),
        ]);
    }

    public static function completedPlans(array $params): void
    {
        $user = Auth::requireUser();
        $athleteId = $params['id'];
        Acl::require(
            $user['id'] === $athleteId || Acl::isTrainerOf($user['id'], $athleteId)
        );
        // Opened from «پیشرفت ورزشکاران» on the reports page.
        Limits::requireReport($user, 'basic', 'پیشرفت ورزشکاران');

        $pdo = Database::connection();
        $rows = [];
        // A list of the trainer's old plans: the history limit applies (Limits).
        $cutoff = Limits::historyCutoff($pdo, $user['id']);

        foreach (['workout', 'nutrition'] as $kind) {
            $stmt = $pdo->prepare(
                'SELECT id, title, assigned_at FROM ' . Acl::planTable($kind) . "
                 WHERE trainer_id = :trainer_id AND athlete_id = :athlete_id AND status = 'completed'"
                . Limits::historyVisibleSql($cutoff)
            );
            $stmt->execute(['trainer_id' => $user['id'], 'athlete_id' => $athleteId]
                + ($cutoff !== null ? ['history_cutoff' => $cutoff] : []));
            foreach ($stmt->fetchAll() as $row) {
                $rows[] = $row + ['kind' => $kind];
            }
        }

        usort($rows, static fn (array $a, array $b) => strcmp($b['assigned_at'], $a['assigned_at']));

        Response::ok(['items' => $rows]);
    }

    private static function rate(int $completed, int $total): int
    {
        return $total === 0 ? 0 : (int) round($completed / $total * 100);
    }
}
