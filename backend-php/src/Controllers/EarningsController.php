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

/** The trainer's private fee ledger — every row is scoped to trainer_id. */
final class EarningsController
{
    public static function list(): void
    {
        $user = Auth::requireUser();

        $stmt = Database::connection()->prepare(
            'SELECT tp.id, tp.athlete_id, tp.amount_toman, tp.paid_at, tp.note,
                    p.first_name, p.last_name
             FROM trainer_payments tp
             LEFT JOIN profiles p ON p.id = tp.athlete_id
             WHERE tp.trainer_id = :trainer_id
             ORDER BY tp.paid_at DESC, tp.created_at DESC'
        );
        $stmt->execute(['trainer_id' => $user['id']]);

        Response::ok(['items' => Cast::rows($stmt->fetchAll(), [], ['amount_toman'])]);
    }

    public static function create(): void
    {
        $user = Auth::requireUser();
        $data = Validate::required(Validate::body(), ['amount_toman', 'paid_at']);

        if ((int) $data['amount_toman'] <= 0) {
            Response::error(400, 'invalid_amount', 'Amount must be greater than zero.');
            return;
        }

        $athleteId = Validate::nullableString($data['athlete_id'] ?? null);
        if ($athleteId !== null) {
            Acl::require(Acl::isTrainerOf($user['id'], $athleteId), 'This athlete is not on your roster.');
        }

        $id = Uuid::v4();
        Database::connection()->prepare(
            'INSERT INTO trainer_payments (id, trainer_id, athlete_id, amount_toman, paid_at, note)
             VALUES (:id, :trainer_id, :athlete_id, :amount_toman, :paid_at, :note)'
        )->execute([
            'id'           => $id,
            'trainer_id'   => $user['id'],
            'athlete_id'   => $athleteId,
            'amount_toman' => (int) $data['amount_toman'],
            'paid_at'      => (string) $data['paid_at'],
            'note'         => Validate::nullableString($data['note'] ?? null),
        ]);

        Response::ok(['id' => $id], 201);
    }

    public static function update(array $params): void
    {
        $user = Auth::requireUser();
        $data = Validate::body();

        $fields = [];
        $bind = ['id' => $params['id'], 'trainer_id' => $user['id']];

        foreach (['athlete_id', 'amount_toman', 'paid_at', 'note'] as $key) {
            if (array_key_exists($key, $data)) {
                $fields[] = "{$key} = :{$key}";
                $bind[$key] = $data[$key] === null ? null : (string) $data[$key];
            }
        }

        if ($fields === []) {
            Response::error(400, 'no_fields', 'Nothing to update.');
            return;
        }

        $stmt = Database::connection()->prepare(
            'UPDATE trainer_payments SET ' . implode(', ', $fields) . ' WHERE id = :id AND trainer_id = :trainer_id'
        );
        $stmt->execute($bind);

        if ($stmt->rowCount() === 0) {
            Response::error(404, 'not_found', 'Payment entry not found.');
            return;
        }

        Response::ok(['ok' => true]);
    }

    public static function remove(array $params): void
    {
        $user = Auth::requireUser();

        $stmt = Database::connection()->prepare(
            'DELETE FROM trainer_payments WHERE id = :id AND trainer_id = :trainer_id'
        );
        $stmt->execute(['id' => $params['id'], 'trainer_id' => $user['id']]);

        if ($stmt->rowCount() === 0) {
            Response::error(404, 'not_found', 'Payment entry not found.');
            return;
        }

        Response::ok(['ok' => true]);
    }
}
