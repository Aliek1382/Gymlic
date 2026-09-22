<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Acl;
use Gymlic\Auth;
use Gymlic\Cast;
use Gymlic\Database;
use Gymlic\Response;

/** Trainer-side analytics. All read-only. */
final class ReportController
{
    public static function monthlyStats(): void
    {
        $user = Auth::requireUser();
        $monthStart = date('Y-m-01 00:00:00');

        $stmt = Database::connection()->prepare(
            "SELECT
               (SELECT COUNT(*) FROM trainer_athletes
                 WHERE trainer_id = :u1 AND status = 'active') AS athletes_count,
               (SELECT COUNT(*) FROM workout_assignments
                 WHERE trainer_id = :u2 AND is_template = 0 AND status <> 'draft'
                   AND assigned_at >= :m1) AS workout_plans_this_month,
               (SELECT COUNT(*) FROM nutrition_assignments
                 WHERE trainer_id = :u3 AND is_template = 0 AND status <> 'draft'
                   AND assigned_at >= :m2) AS nutrition_plans_this_month"
        );
        $stmt->execute([
            'u1' => $user['id'], 'u2' => $user['id'], 'u3' => $user['id'],
            'm1' => $monthStart, 'm2' => $monthStart,
        ]);

        Response::ok(Cast::row($stmt->fetch(), [], [
            'athletes_count', 'workout_plans_this_month', 'nutrition_plans_this_month',
        ]));
    }

    /** Completed plan count per athlete on the trainer's roster. */
    public static function athleteProgress(): void
    {
        $user = Auth::requireUser();

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
        $from = $_GET['from'] ?? date('Y-m-d', strtotime('-7 days'));
        $pdo = Database::connection();

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
            'plans' => array_values($planByAthlete),
            'logs'  => $logs->fetchAll(),
        ]);
    }

    public static function completionRates(): void
    {
        $user = Auth::requireUser();

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

        $pdo = Database::connection();
        $rows = [];

        foreach (['workout', 'nutrition'] as $kind) {
            $stmt = $pdo->prepare(
                'SELECT id, title, assigned_at FROM ' . Acl::planTable($kind) . "
                 WHERE trainer_id = :trainer_id AND athlete_id = :athlete_id AND status = 'completed'"
            );
            $stmt->execute(['trainer_id' => $user['id'], 'athlete_id' => $athleteId]);
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
