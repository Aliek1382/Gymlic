<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Acl;
use Gymlic\Auth;
use Gymlic\Cast;
use Gymlic\Database;
use Gymlic\Limits;
use Gymlic\Response;
use Gymlic\Uuid;
use Gymlic\Validate;
use Gymlic\Templates;

final class ProgressController
{
    private const COLUMNS = 'id, athlete_id, recorded_by, height_cm, weight_kg, body_fat_percent, waist_cm, chest_cm, note, recorded_at';
    private const MEASURES = ['height_cm', 'weight_kg', 'body_fat_percent', 'waist_cm', 'chest_cm'];

    /** Oldest-first: the order the progress charts and "latest known height" both want. */
    public static function list(array $params): void
    {
        $user = Auth::requireUser();
        $athleteId = $params['id'];

        Acl::require(
            $user['id'] === $athleteId
            || Acl::isTrainerOf($user['id'], $athleteId)
            || Acl::isClubAthleteOfManager($user['id'], $athleteId)
        );

        $stmt = Database::connection()->prepare(
            'SELECT ' . self::COLUMNS . ' FROM measurements WHERE athlete_id = :id ORDER BY recorded_at ASC'
        );
        $stmt->execute(['id' => $athleteId]);

        Response::ok(['items' => Cast::rows($stmt->fetchAll(), self::MEASURES)]);
    }

    public static function create(array $params): void
    {
        $user = Auth::requireUser();
        $athleteId = $params['id'];

        Acl::require($user['id'] === $athleteId || Acl::isTrainerOf($user['id'], $athleteId));

        $data = Validate::body();
        $id = Uuid::v4();
        $pdo = Database::connection();

        $pdo->prepare(
            'INSERT INTO measurements (id, athlete_id, recorded_by, height_cm, weight_kg, body_fat_percent, waist_cm, chest_cm, note)
             VALUES (:id, :athlete_id, :recorded_by, :height_cm, :weight_kg, :body_fat_percent, :waist_cm, :chest_cm, :note)'
        )->execute([
            'id'               => $id,
            'athlete_id'       => $athleteId,
            'recorded_by'      => $user['id'],
            'height_cm'        => $data['height_cm'] ?? null,
            'weight_kg'        => $data['weight_kg'] ?? null,
            'body_fat_percent' => $data['body_fat_percent'] ?? null,
            'waist_cm'         => $data['waist_cm'] ?? null,
            'chest_cm'         => $data['chest_cm'] ?? null,
            'note'             => Validate::nullableString($data['note'] ?? null),
        ]);

        self::notifyMeasurement($user, $athleteId);

        Response::ok(['id' => $id], 201);
    }

    /** Only the person who recorded an entry may edit it (RLS: recorded_by = caller). */
    public static function update(array $params): void
    {
        $user = Auth::requireUser();
        $data = Validate::body();

        $fields = [];
        $bind = ['id' => $params['id'], 'recorded_by' => $user['id']];

        foreach (array_merge(self::MEASURES, ['note']) as $key) {
            if (array_key_exists($key, $data)) {
                $fields[] = "{$key} = :{$key}";
                $bind[$key] = $data[$key];
            }
        }

        if ($fields === []) {
            Response::error(400, 'no_fields', 'Nothing to update.');
            return;
        }

        $stmt = Database::connection()->prepare(
            'UPDATE measurements SET ' . implode(', ', $fields) . ' WHERE id = :id AND recorded_by = :recorded_by'
        );
        $stmt->execute($bind);

        if ($stmt->rowCount() === 0) {
            Response::error(403, 'forbidden', 'You can only edit entries you recorded.');
            return;
        }

        Response::ok(['ok' => true]);
    }

    /** Trainer: the reminder settings for one athlete, or the defaults if none were saved yet. */
    public static function getReminder(array $params): void
    {
        $user = Auth::requireUser();
        $athleteId = $params['athleteId'];

        Acl::require(Acl::isTrainerOf($user['id'], $athleteId));

        $stmt = Database::connection()->prepare(
            'SELECT interval_weeks, is_active, last_reminded_at FROM assessment_reminders
             WHERE trainer_id = :trainer_id AND athlete_id = :athlete_id'
        );
        $stmt->execute(['trainer_id' => $user['id'], 'athlete_id' => $athleteId]);
        $row = $stmt->fetch();

        Response::ok($row === false
            ? ['interval_weeks' => 4, 'is_active' => true, 'last_reminded_at' => null]
            : [
                'interval_weeks'   => (int) $row['interval_weeks'],
                'is_active'        => (bool) $row['is_active'],
                'last_reminded_at' => $row['last_reminded_at'],
            ]);
    }

    /** Trainer: set the re-measure interval (weeks) and on/off for one athlete. */
    public static function setReminder(array $params): void
    {
        $user = Auth::requireUser();
        $athleteId = $params['athleteId'];

        Acl::require(Acl::isTrainerOf($user['id'], $athleteId));
        Limits::requireWritable($user['id'], $athleteId);

        $data = Validate::body();
        $weeks = $data['interval_weeks'] ?? 4;
        if (!is_int($weeks) || $weeks < 1 || $weeks > 52) {
            Response::error(400, 'invalid_interval', 'interval_weeks must be a whole number from 1 to 52.');
            return;
        }
        $active = $data['is_active'] ?? true;
        if (!is_bool($active)) {
            Response::error(400, 'invalid_is_active', 'is_active must be true or false.');
            return;
        }

        Database::connection()->prepare(
            'INSERT INTO assessment_reminders (id, trainer_id, athlete_id, interval_weeks, is_active)
             VALUES (:id, :trainer_id, :athlete_id, :interval_weeks, :is_active)
             ON DUPLICATE KEY UPDATE interval_weeks = VALUES(interval_weeks), is_active = VALUES(is_active)'
        )->execute([
            'id'             => Uuid::v4(),
            'trainer_id'     => $user['id'],
            'athlete_id'     => $athleteId,
            'interval_weeks' => $weeks,
            'is_active'      => $active ? 1 : 0,
        ]);

        Response::ok(['interval_weeks' => $weeks, 'is_active' => $active]);
    }

    /**
     * Called by cron/assessment-reminders.php. An active reminder is due once the
     * athlete's latest measurement (or, if they have none, the day the reminder
     * was created) is at least interval_weeks old AND we have not already
     * reminded within the same interval. The reminder row is claimed with a
     * conditional UPDATE before notifying, so overlapping runs send nothing twice.
     * An athlete measuring in time pushes the due date out, so they get nothing.
     * Returns how many notifications were created.
     */
    public static function sendDueReminders(): int
    {
        $pdo = Database::connection();

        $due = $pdo->query(
            "SELECT ar.id, ar.trainer_id, ar.athlete_id
             FROM assessment_reminders ar
             JOIN trainer_athletes ta
               ON ta.trainer_id = ar.trainer_id AND ta.athlete_id = ar.athlete_id AND ta.status = 'active'
             WHERE ar.is_active = 1
               AND COALESCE((SELECT MAX(m.recorded_at) FROM measurements m WHERE m.athlete_id = ar.athlete_id), ar.created_at)
                   <= DATE_SUB(NOW(), INTERVAL ar.interval_weeks WEEK)
               AND (ar.last_reminded_at IS NULL OR ar.last_reminded_at < DATE_SUB(NOW(), INTERVAL ar.interval_weeks WEEK))"
        )->fetchAll();

        $claim = $pdo->prepare(
            'UPDATE assessment_reminders SET last_reminded_at = NOW()
             WHERE id = :id AND (last_reminded_at IS NULL OR last_reminded_at < DATE_SUB(NOW(), INTERVAL interval_weeks WEEK))'
        );

        $sent = 0;
        $notified = [];
        foreach ($due as $row) {
            $claim->execute(['id' => $row['id']]);
            if ($claim->rowCount() === 0) {
                continue;
            }
            // An athlete with two trainers who both set a reminder still gets one notification per run.
            if (isset($notified[$row['athlete_id']])) {
                continue;
            }
            $notified[$row['athlete_id']] = true;

            Templates::notify(
                $pdo,
                'assessment_reminder',
                $row['athlete_id'],
                $row['trainer_id'],
                'assessment_reminder',
                [],
                '/progress'
            );
            $sent++;
        }

        return $sent;
    }

    /**
     * notify_measurement_recorded (0020): an athlete's own entry notifies every
     * active trainer; a trainer's entry notifies the athlete.
     */
    private static function notifyMeasurement(array $user, string $athleteId): void
    {
        $pdo = Database::connection();
        $name = trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? ''));

        if ($user['id'] === $athleteId) {
            $stmt = $pdo->prepare(
                "SELECT trainer_id FROM trainer_athletes WHERE athlete_id = :id AND status = 'active'"
            );
            $stmt->execute(['id' => $athleteId]);
            foreach ($stmt->fetchAll() as $row) {
                Templates::notify(
                    $pdo,
                    'measurement_by_athlete',
                    $row['trainer_id'],
                    $user['id'],
                    'measurement_recorded',
                    ['name' => $name],
                    '/athletes/' . $athleteId
                );
            }
            return;
        }

        Templates::notify(
            $pdo,
            'measurement_by_trainer',
            $athleteId,
            $user['id'],
            'measurement_recorded',
            ['name' => $name],
            '/progress'
        );
    }
}
