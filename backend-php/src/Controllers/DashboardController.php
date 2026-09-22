<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Acl;
use Gymlic\Auth;
use Gymlic\Cast;
use Gymlic\Database;
use Gymlic\Response;

/**
 * Read-only aggregates. Each of these fired 8-13 parallel Supabase queries
 * from the browser; here one request returns the whole payload, which matters
 * more on a shared host than it did against a managed Postgres.
 */
final class DashboardController
{
    public static function athlete(): void
    {
        $user = Auth::requireUser();
        $pdo = Database::connection();
        $payload = [];

        foreach (['workout' => 'todays_workout', 'nutrition' => 'nutrition_plan'] as $kind => $key) {
            $stmt = $pdo->prepare(
                'SELECT id, title, description, assigned_at FROM ' . Acl::planTable($kind) . "
                 WHERE athlete_id = :athlete_id AND status = 'active' AND is_template = 0
                 ORDER BY assigned_at DESC LIMIT 1"
            );
            $stmt->execute(['athlete_id' => $user['id']]);
            $payload[$key] = $stmt->fetch() ?: null;
        }

        Response::ok($payload);
    }

    public static function trainer(): void
    {
        $user = Auth::requireUser();
        $pdo = Database::connection();

        $counts = $pdo->prepare(
            "SELECT
               (SELECT COUNT(*) FROM trainer_athletes
                 WHERE trainer_id = :u1 AND status = 'active') AS athletes_count,
               (SELECT COUNT(*) FROM workout_assignments
                 WHERE trainer_id = :u2 AND status = 'active' AND is_template = 0) AS active_workout_count,
               (SELECT COUNT(*) FROM nutrition_assignments
                 WHERE trainer_id = :u3 AND status = 'active' AND is_template = 0) AS active_nutrition_count,
               (SELECT COUNT(*) FROM workout_assignments
                 WHERE trainer_id = :u4 AND status = 'completed' AND is_template = 0)
               + (SELECT COUNT(*) FROM nutrition_assignments
                 WHERE trainer_id = :u5 AND status = 'completed' AND is_template = 0) AS completed_count"
        );
        $counts->execute([
            'u1' => $user['id'], 'u2' => $user['id'], 'u3' => $user['id'],
            'u4' => $user['id'], 'u5' => $user['id'],
        ]);

        Response::ok([
            'statistics' => Cast::row($counts->fetch(), [], [
                'athletes_count', 'active_workout_count', 'active_nutrition_count', 'completed_count',
            ]),
            'activity' => self::trainerActivity($user['id'], (int) ($_GET['limit'] ?? 10)),
            'drafts'   => self::trainerDrafts($user['id'], 5),
        ]);
    }

    public static function club(array $params): void
    {
        $user = Auth::requireUser();
        $clubId = $params['id'];
        Acl::require(Acl::isClubMember($user['id'], $clubId));

        $pdo = Database::connection();

        $stmt = $pdo->prepare(
            "SELECT
               (SELECT COUNT(*) FROM memberships
                 WHERE club_id = :c1 AND role = 'athlete' AND status = 'active') AS member_count,
               (SELECT COUNT(*) FROM memberships
                 WHERE club_id = :c2 AND role = 'athlete' AND status = 'active'
                   AND joined_at >= :month_start) AS members_this_month,
               (SELECT COUNT(*) FROM memberships
                 WHERE club_id = :c3 AND role = 'athlete' AND status = 'active'
                   AND joined_at >= :prev_start AND joined_at < :month_start2) AS members_last_month,
               (SELECT COUNT(*) FROM memberships
                 WHERE club_id = :c4 AND role = 'trainer' AND status = 'active') AS trainer_count,
               (SELECT COALESCE(SUM(amount), 0) FROM revenue_entries
                 WHERE club_id = :c5 AND occurred_at >= :month_start3) AS revenue_this_month,
               (SELECT COALESCE(SUM(amount), 0) FROM revenue_entries
                 WHERE club_id = :c6 AND occurred_at >= :prev_start2 AND occurred_at < :month_start4)
                 AS revenue_last_month"
        );
        $monthStart = date('Y-m-01');
        $prevStart = date('Y-m-01', strtotime('-1 month'));
        $stmt->execute([
            'c1' => $clubId, 'c2' => $clubId, 'c3' => $clubId,
            'c4' => $clubId, 'c5' => $clubId, 'c6' => $clubId,
            'month_start' => $monthStart, 'month_start2' => $monthStart,
            'month_start3' => $monthStart, 'month_start4' => $monthStart,
            'prev_start' => $prevStart, 'prev_start2' => $prevStart,
        ]);

        $attendance = $pdo->prepare(
            'SELECT COUNT(*) AS total, COALESCE(SUM(attended), 0) AS attended
             FROM class_attendance_logs WHERE club_id = :club_id AND class_date >= :from'
        );
        $attendance->execute(['club_id' => $clubId, 'from' => date('Y-m-d', strtotime('-30 days'))]);
        $attendanceRow = $attendance->fetch();

        $series = $pdo->prepare(
            "SELECT DATE_FORMAT(occurred_at, '%Y-%m') AS month, COALESCE(SUM(amount), 0) AS total
             FROM revenue_entries
             WHERE club_id = :club_id AND occurred_at >= :from
             GROUP BY month ORDER BY month ASC"
        );
        $series->execute(['club_id' => $clubId, 'from' => date('Y-m-01', strtotime('-11 months'))]);

        $planDistribution = $pdo->prepare(
            "SELECT COALESCE(cmp.name, 'بدون پلن') AS plan_name, COUNT(*) AS member_count
             FROM memberships m
             LEFT JOIN club_membership_plans cmp ON cmp.id = m.plan_id
             WHERE m.club_id = :club_id AND m.role = 'athlete' AND m.status = 'active'
             GROUP BY plan_name ORDER BY member_count DESC"
        );
        $planDistribution->execute(['club_id' => $clubId]);

        $subscription = $pdo->prepare(
            'SELECT plan_name, status, expires_at FROM subscriptions
             WHERE club_id = :club_id ORDER BY expires_at DESC LIMIT 1'
        );
        $subscription->execute(['club_id' => $clubId]);

        $recentMembers = $pdo->prepare(
            "SELECT m.user_id, m.joined_at, p.first_name, p.last_name, p.avatar_url
             FROM memberships m
             JOIN profiles p ON p.id = m.user_id
             WHERE m.club_id = :club_id AND m.role = 'athlete' AND m.status = 'active'
             ORDER BY m.joined_at DESC LIMIT 5"
        );
        $recentMembers->execute(['club_id' => $clubId]);

        $trainers = $pdo->prepare(
            "SELECT p.id, p.first_name, p.last_name, p.avatar_url
             FROM memberships m
             JOIN profiles p ON p.id = m.user_id
             WHERE m.club_id = :club_id AND m.role = 'trainer' AND m.status = 'active'
             LIMIT 8"
        );
        $trainers->execute(['club_id' => $clubId]);

        $total = (int) $attendanceRow['total'];

        Response::ok([
            'statistics' => Cast::row($stmt->fetch(),
                ['revenue_this_month', 'revenue_last_month'],
                ['member_count', 'members_this_month', 'members_last_month', 'trainer_count']
            ),
            'attendance_rate'   => $total === 0 ? null : (int) round((int) $attendanceRow['attended'] / $total * 100),
            'revenue_series'    => Cast::rows($series->fetchAll(), ['total']),
            'plan_distribution' => Cast::rows($planDistribution->fetchAll(), [], ['member_count']),
            'subscription'      => $subscription->fetch() ?: null,
            'recent_members'    => $recentMembers->fetchAll(),
            'trainers'          => $trainers->fetchAll(),
        ]);
    }

    private static function trainerActivity(string $trainerId, int $limit): array
    {
        $pdo = Database::connection();
        $rows = [];

        foreach (['workout', 'nutrition'] as $kind) {
            $stmt = $pdo->prepare(
                'SELECT a.id, a.title, a.description, a.status, a.assigned_at,
                        p.first_name, p.last_name
                 FROM ' . Acl::planTable($kind) . ' a
                 LEFT JOIN profiles p ON p.id = a.athlete_id
                 WHERE a.trainer_id = :trainer_id AND a.status <> \'draft\' AND a.is_template = 0
                 ORDER BY a.assigned_at DESC LIMIT ' . $limit
            );
            $stmt->execute(['trainer_id' => $trainerId]);
            foreach ($stmt->fetchAll() as $row) {
                $rows[] = $row + ['kind' => $kind];
            }
        }

        usort($rows, static fn (array $a, array $b) => strcmp($b['assigned_at'], $a['assigned_at']));

        return array_slice($rows, 0, $limit);
    }

    /** Unfinished plans, with whoever they are destined for resolved by name. */
    private static function trainerDrafts(string $trainerId, int $limit): array
    {
        $pdo = Database::connection();
        $rows = [];

        foreach (['workout', 'nutrition'] as $kind) {
            $stmt = $pdo->prepare(
                'SELECT a.id, a.title, a.updated_at, a.athlete_id, a.invitation_id,
                        p.first_name AS athlete_first_name, p.last_name AS athlete_last_name,
                        i.first_name AS invite_first_name, i.last_name AS invite_last_name
                 FROM ' . Acl::planTable($kind) . ' a
                 LEFT JOIN profiles p ON p.id = a.athlete_id
                 LEFT JOIN invitations i ON i.id = a.invitation_id
                 WHERE a.trainer_id = :trainer_id AND a.status = \'draft\' AND a.is_template = 0
                 ORDER BY a.updated_at DESC LIMIT ' . $limit
            );
            $stmt->execute(['trainer_id' => $trainerId]);
            foreach ($stmt->fetchAll() as $row) {
                $rows[] = $row + ['kind' => $kind];
            }
        }

        usort($rows, static fn (array $a, array $b) => strcmp($b['updated_at'], $a['updated_at']));

        return array_slice($rows, 0, $limit);
    }
}
