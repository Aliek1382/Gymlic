<?php
declare(strict_types=1);

namespace Gymlic;

/**
 * Ports the Postgres RLS helper functions (supabase/migrations 0001, 0023,
 * 0034, 0036) to PHP. In Postgres these ran implicitly on every row; here each
 * endpoint calls them explicitly before reading or writing.
 */
final class Acl
{
    /** is_club_member(club_id) — caller has an active membership in the club. */
    public static function isClubMember(string $userId, string $clubId): bool
    {
        $stmt = Database::connection()->prepare(
            "SELECT 1 FROM memberships WHERE club_id = :club_id AND user_id = :user_id AND status = 'active'"
        );
        $stmt->execute(['club_id' => $clubId, 'user_id' => $userId]);
        return $stmt->fetch() !== false;
    }

    /** has_club_role(club_id, roles[]) — caller's active membership role is in the set. */
    public static function hasClubRole(string $userId, string $clubId, array $roles): bool
    {
        $placeholders = implode(',', array_fill(0, count($roles), '?'));
        $stmt = Database::connection()->prepare(
            "SELECT 1 FROM memberships
             WHERE club_id = ? AND user_id = ? AND status = 'active' AND role IN ({$placeholders})"
        );
        $stmt->execute(array_merge([$clubId, $userId], $roles));
        return $stmt->fetch() !== false;
    }

    /** Club owner or reception — the "manages this club" check used throughout. */
    public static function managesClub(string $userId, string $clubId): bool
    {
        return self::hasClubRole($userId, $clubId, ['owner', 'reception']);
    }

    /** is_trainer_of(athlete_id) — caller actively trains the athlete. */
    public static function isTrainerOf(string $userId, string $athleteId): bool
    {
        $stmt = Database::connection()->prepare(
            "SELECT 1 FROM trainer_athletes
             WHERE trainer_id = :trainer_id AND athlete_id = :athlete_id AND status = 'active'"
        );
        $stmt->execute(['trainer_id' => $userId, 'athlete_id' => $athleteId]);
        return $stmt->fetch() !== false;
    }

    /** is_club_athlete_of_manager(user_id) — target is an athlete in a club the caller manages. */
    public static function isClubAthleteOfManager(string $userId, string $targetId): bool
    {
        $stmt = Database::connection()->prepare(
            "SELECT 1
             FROM memberships target
             JOIN memberships manager ON manager.club_id = target.club_id
             WHERE target.user_id = :target_id AND target.role = 'athlete' AND target.status = 'active'
               AND manager.user_id = :user_id AND manager.status = 'active'
               AND manager.role IN ('owner','reception')"
        );
        $stmt->execute(['target_id' => $targetId, 'user_id' => $userId]);
        return $stmt->fetch() !== false;
    }

    /** Whether the caller may read the target user's profile at all. */
    public static function canViewProfile(array $caller, string $targetId): bool
    {
        if ($caller['id'] === $targetId || (int) $caller['is_platform_admin'] === 1) {
            return true;
        }

        $stmt = Database::connection()->prepare(
            "SELECT 1 FROM memberships a
             JOIN memberships b ON b.club_id = a.club_id
             WHERE a.user_id = :caller AND a.status = 'active'
               AND b.user_id = :target AND b.status = 'active'"
        );
        $stmt->execute(['caller' => $caller['id'], 'target' => $targetId]);
        if ($stmt->fetch() !== false) {
            return true;
        }

        $stmt = Database::connection()->prepare(
            "SELECT 1 FROM trainer_athletes
             WHERE status = 'active'
               AND ((trainer_id = :caller AND athlete_id = :target)
                 OR (athlete_id = :caller2 AND trainer_id = :target2))"
        );
        $stmt->execute([
            'caller'  => $caller['id'],
            'target'  => $targetId,
            'caller2' => $caller['id'],
            'target2' => $targetId,
        ]);
        return $stmt->fetch() !== false;
    }

    /** can_message(other_user_id) — an active trainer link, or a shared real plan. */
    public static function canMessage(string $userId, string $otherId): bool
    {
        if ($userId === $otherId) {
            return false;
        }

        $pdo = Database::connection();

        $stmt = $pdo->prepare(
            "SELECT 1 FROM trainer_athletes
             WHERE status = 'active'
               AND ((trainer_id = :a AND athlete_id = :b) OR (trainer_id = :b2 AND athlete_id = :a2))"
        );
        $stmt->execute(['a' => $userId, 'b' => $otherId, 'a2' => $userId, 'b2' => $otherId]);
        if ($stmt->fetch() !== false) {
            return true;
        }

        foreach (['workout_assignments', 'nutrition_assignments'] as $table) {
            $stmt = $pdo->prepare(
                "SELECT 1 FROM {$table}
                 WHERE is_template = 0 AND status <> 'draft'
                   AND ((trainer_id = :a AND athlete_id = :b) OR (trainer_id = :b2 AND athlete_id = :a2))"
            );
            $stmt->execute(['a' => $userId, 'b' => $otherId, 'a2' => $userId, 'b2' => $otherId]);
            if ($stmt->fetch() !== false) {
                return true;
            }
        }

        return false;
    }

    public static function planTable(string $kind): string
    {
        return $kind === 'nutrition' ? 'nutrition_assignments' : 'workout_assignments';
    }

    /** plan_belongs_to_pair(kind, plan_id, other) — the plan's trainer/athlete pair is exactly these two. */
    public static function planBelongsToPair(string $kind, string $planId, string $userId, string $otherId): bool
    {
        $table = self::planTable($kind);
        $stmt = Database::connection()->prepare(
            "SELECT 1 FROM {$table}
             WHERE id = :id
               AND ((trainer_id = :a AND athlete_id = :b) OR (trainer_id = :b2 AND athlete_id = :a2))"
        );
        $stmt->execute(['id' => $planId, 'a' => $userId, 'b' => $otherId, 'a2' => $userId, 'b2' => $otherId]);
        return $stmt->fetch() !== false;
    }

    /** Whether the caller may read a plan: its trainer, its athlete, or a manager of its club. */
    public static function canViewPlan(array $caller, array $plan): bool
    {
        if ($caller['id'] === $plan['trainer_id'] || $caller['id'] === $plan['athlete_id']) {
            return true;
        }
        if ($plan['club_id'] !== null && self::managesClub($caller['id'], $plan['club_id'])) {
            return true;
        }
        if ($plan['athlete_id'] !== null && self::isClubAthleteOfManager($caller['id'], $plan['athlete_id'])) {
            return true;
        }
        return (int) $caller['is_platform_admin'] === 1;
    }

    /** Ends the request with 403 unless the condition holds. */
    public static function require(bool $allowed, string $message = 'You do not have access to this resource.'): void
    {
        if (!$allowed) {
            Response::error(403, 'forbidden', $message);
            exit;
        }
    }
}
