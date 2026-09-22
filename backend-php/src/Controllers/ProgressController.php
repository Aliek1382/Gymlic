<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Acl;
use Gymlic\Auth;
use Gymlic\Cast;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Uuid;
use Gymlic\Validate;

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
                AuthController::notify(
                    $pdo,
                    $row['trainer_id'],
                    $user['id'],
                    'measurement_recorded',
                    'اندازه‌گیری جدید',
                    $name . ' اندازه‌گیری جدیدی ثبت کرد.',
                    '/athletes/' . $athleteId
                );
            }
            return;
        }

        AuthController::notify(
            $pdo,
            $athleteId,
            $user['id'],
            'measurement_recorded',
            'اندازه‌گیری جدید',
            $name . ' برای شما اندازه‌گیری جدیدی ثبت کرد.',
            '/progress'
        );
    }
}
