<?php

declare(strict_types=1);

namespace Gymlic;

/**
 * A payer taking back a request that nobody has answered yet: the row and its
 * receipt go, as if it had never been sent. Anything already approved or
 * rejected stays, as the record of what happened.
 */
final class PaymentCancel
{
    private const OWNERS = [
        'payment_requests'            => 'submitted_by',
        'trainer_payment_requests'    => 'trainer_id',
        'membership_payment_requests' => 'athlete_id',
        'invoice_payment_claims'      => 'athlete_id',
    ];

    /** @return string 'ok' | 'not_found' | 'not_pending' */
    public static function own(string $table, string $id, string $userId): string
    {
        $owner = self::OWNERS[$table] ?? null;
        if ($owner === null || !Database::hasTable($table)) {
            return 'not_found';
        }

        $pdo = Database::connection();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("SELECT status, receipt_path FROM {$table} WHERE id = :id AND {$owner} = :u FOR UPDATE");
            $stmt->execute(['id' => $id, 'u' => $userId]);
            $row = $stmt->fetch();
            if ($row === false) {
                $pdo->rollBack();
                return 'not_found';
            }
            if ($row['status'] !== 'pending') {
                $pdo->rollBack();
                return 'not_pending';
            }
            $pdo->prepare("DELETE FROM {$table} WHERE id = :id")->execute(['id' => $id]);
            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }

        Receipts::remove($row['receipt_path']);
        return 'ok';
    }

    /** Respond for a result of own(). */
    public static function respond(string $result): void
    {
        match ($result) {
            'ok'          => Response::ok(['cancelled' => true]),
            'not_pending' => Response::error(409, 'not_pending', 'این درخواست قبلاً بررسی شده و دیگر قابل لغو نیست.'),
            default       => Response::error(404, 'not_found', 'درخواست پیدا نشد.'),
        };
    }
}
