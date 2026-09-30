<?php
declare(strict_types=1);

namespace Gymlic;

use Throwable;

/**
 * Coach gamification: points for defined actions, and a level derived from the
 * running total. The per-action numbers live in the `point_rules` table so the
 * owner can change or switch one off from phpMyAdmin without a deploy; the
 * level thresholds are fixed here because nobody edits them regularly.
 */
final class PointsService
{
    private const LEVELS = [
        ['name' => 'تازه‌کار', 'min_points' => 0],
        ['name' => 'مربی فعال', 'min_points' => 100],
        ['name' => 'مربی حرفه‌ای', 'min_points' => 500],
        ['name' => 'مربی برتر', 'min_points' => 2000],
    ];

    /**
     * Logs one point row for the coach. Never throws: a missing or inactive
     * rule is a no-op, and any database error (including the tables not
     * existing yet) is swallowed, because awarding points must never fail the
     * action the coach actually performed.
     */
    public static function award(string $coachId, string $actionType): void
    {
        try {
            $pdo = Database::connection();

            $rule = $pdo->prepare('SELECT points FROM point_rules WHERE action_type = :action AND is_active = 1');
            $rule->execute(['action' => $actionType]);
            $points = $rule->fetchColumn();
            if ($points === false || (int) $points <= 0) {
                return;
            }

            // `points` is copied, not referenced, so later rule changes leave history alone.
            $pdo->prepare(
                'INSERT INTO coach_point_logs (id, coach_id, action_type, points)
                 VALUES (:id, :coach_id, :action, :points)'
            )->execute([
                'id'       => Uuid::v4(),
                'coach_id' => $coachId,
                'action'   => $actionType,
                'points'   => (int) $points,
            ]);
        } catch (Throwable $e) {
            error_log('PointsService::award failed: ' . $e->getMessage());
        }
    }

    /**
     * Highest level whose min_points the total reaches, plus the points still
     * needed for the next one (null at the top level).
     *
     * @return array{name: string, min_points: int, next_level: ?string, next_min_points: ?int, points_to_next_level: ?int}
     */
    public static function currentLevel(int $totalPoints): array
    {
        $index = 0;
        foreach (self::LEVELS as $i => $level) {
            if ($totalPoints >= $level['min_points']) {
                $index = $i;
            }
        }

        $next = self::LEVELS[$index + 1] ?? null;

        return [
            'name'                 => self::LEVELS[$index]['name'],
            'min_points'           => self::LEVELS[$index]['min_points'],
            'next_level'           => $next['name'] ?? null,
            'next_min_points'      => $next['min_points'] ?? null,
            'points_to_next_level' => $next !== null ? $next['min_points'] - $totalPoints : null,
        ];
    }
}
