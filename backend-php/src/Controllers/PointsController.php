<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Auth;
use Gymlic\Cast;
use Gymlic\Database;
use Gymlic\PointsService;
use Gymlic\Response;

/** A coach's own points. Every query is scoped to the caller; there is no cross-coach view. */
final class PointsController
{
    private const RECENT_LOGS = 20;

    public static function me(): void
    {
        $user = Auth::requireUser();
        $pdo = Database::connection();

        $sum = $pdo->prepare('SELECT COALESCE(SUM(points), 0) FROM coach_point_logs WHERE coach_id = :id');
        $sum->execute(['id' => $user['id']]);
        $total = (int) $sum->fetchColumn();

        // LEFT JOIN: a rule the owner later deleted must not hide its history.
        $logs = $pdo->prepare(
            'SELECT l.id, l.action_type, COALESCE(r.label, l.action_type) AS label, l.points, l.created_at
             FROM coach_point_logs l
             LEFT JOIN point_rules r ON r.action_type = l.action_type
             WHERE l.coach_id = :id
             ORDER BY l.created_at DESC, l.id
             LIMIT ' . self::RECENT_LOGS
        );
        $logs->execute(['id' => $user['id']]);

        $level = PointsService::currentLevel($total);

        Response::ok([
            'total_points'         => $total,
            'current_level'        => $level,
            'points_to_next_level' => $level['points_to_next_level'],
            'recent_logs'          => Cast::rows($logs->fetchAll(), [], ['points']),
        ]);
    }
}
