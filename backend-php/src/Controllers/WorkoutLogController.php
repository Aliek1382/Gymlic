<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Acl;
use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Uuid;
use Gymlic\Validate;

final class WorkoutLogController
{
    /**
     * Logs from `from` onward, for the caller or for athletes they train.
     * `athlete_ids` serves the trainer's roster, where every row's streak is
     * computed at once rather than one request per athlete.
     */
    public static function list(): void
    {
        $user = Auth::requireUser();
        $from = $_GET['from'] ?? date('Y-m-d', strtotime('-12 weeks'));

        $ids = isset($_GET['athlete_ids']) && $_GET['athlete_ids'] !== ''
            ? explode(',', (string) $_GET['athlete_ids'])
            : [(string) ($_GET['athlete_id'] ?? $user['id'])];

        foreach ($ids as $athleteId) {
            Acl::require(
                $athleteId === $user['id'] || Acl::isTrainerOf($user['id'], $athleteId),
                'You cannot read this athlete\'s logs.'
            );
        }

        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = Database::connection()->prepare(
            "SELECT id, assignment_id, athlete_id, day_key, completed_on
             FROM workout_day_logs
             WHERE athlete_id IN ({$placeholders}) AND completed_on >= ?
             ORDER BY completed_on DESC"
        );
        $stmt->execute(array_merge($ids, [$from]));

        Response::ok(['items' => $stmt->fetchAll()]);
    }

    public static function create(): void
    {
        $user = Auth::requireUser();
        $data = Validate::required(Validate::body(), ['assignment_id', 'day_key', 'completed_on']);

        $stmt = Database::connection()->prepare(
            'SELECT athlete_id FROM workout_assignments WHERE id = :id'
        );
        $stmt->execute(['id' => $data['assignment_id']]);
        $plan = $stmt->fetch();

        if ($plan === false) {
            Response::error(404, 'not_found', 'Plan not found.');
            return;
        }
        Acl::require($plan['athlete_id'] === $user['id'], 'Only the athlete can tick off their own days.');

        // The unique key makes re-ticking the same day a no-op rather than an error.
        Database::connection()->prepare(
            'INSERT INTO workout_day_logs (id, assignment_id, athlete_id, day_key, completed_on)
             VALUES (:id, :assignment_id, :athlete_id, :day_key, :completed_on)
             ON DUPLICATE KEY UPDATE id = id'
        )->execute([
            'id'            => Uuid::v4(),
            'assignment_id' => $data['assignment_id'],
            'athlete_id'    => $user['id'],
            'day_key'       => (string) $data['day_key'],
            'completed_on'  => (string) $data['completed_on'],
        ]);

        Response::ok(['ok' => true], 201);
    }

    public static function remove(array $params): void
    {
        $user = Auth::requireUser();

        $stmt = Database::connection()->prepare(
            'DELETE FROM workout_day_logs WHERE id = :id AND athlete_id = :athlete_id'
        );
        $stmt->execute(['id' => $params['id'], 'athlete_id' => $user['id']]);

        if ($stmt->rowCount() === 0) {
            Response::error(404, 'not_found', 'Log entry not found.');
            return;
        }

        Response::ok(['ok' => true]);
    }
}
