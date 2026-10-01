<?php
declare(strict_types=1);

namespace Gymlic;

use PDO;

/**
 * A club's platform subscription: one row per club in `subscriptions`.
 *
 * The status is worked out from expires_at whenever it is read, never trusted
 * from the stored column: nothing ever moved a row from 'active' to
 * 'expiring' or 'expired', so every subscription used to show as active
 * forever. The column is still written (as of that moment) so a look at the
 * table in phpMyAdmin isn't misleading on the day it changes.
 */
final class Subscriptions
{
    private function __construct()
    {
    }

    /** 'active' | 'expiring' | 'expired', or null for no subscription. */
    public static function status(?string $expiresAt): ?string
    {
        if ($expiresAt === null || $expiresAt === '') {
            return null;
        }
        $expires = strtotime($expiresAt);
        if ($expires === false || $expires <= time()) {
            return 'expired';
        }
        $days = Settings::get('billing')['expiring_days'];
        return $expires <= time() + $days * 86400 ? 'expiring' : 'active';
    }

    /** Whole days left, rounded up; 0 once expired. */
    public static function remainingDays(?string $expiresAt): ?int
    {
        if ($expiresAt === null || $expiresAt === '') {
            return null;
        }
        $left = (int) strtotime($expiresAt) - time();
        return $left > 0 ? (int) ceil($left / 86400) : 0;
    }

    /**
     * Rewrites $statusKey on each row from $expiresKey (rows from a LEFT JOIN
     * keep a null status when the club has no subscription).
     *
     * @param array<int, array<string, mixed>> $rows
     * @return array<int, array<string, mixed>>
     */
    public static function withStatus(array $rows, string $statusKey, string $expiresKey): array
    {
        foreach ($rows as &$row) {
            if (array_key_exists($statusKey, $row)) {
                $row[$statusKey] = self::status($row[$expiresKey] ?? null);
            }
        }
        unset($row);
        return $rows;
    }

    /** @return array{id: string, plan_name: string, expires_at: string}|null */
    public static function latest(PDO $pdo, string $clubId, bool $lock = false): ?array
    {
        $stmt = $pdo->prepare(
            'SELECT id, plan_name, expires_at FROM subscriptions
             WHERE club_id = :club_id ORDER BY expires_at DESC LIMIT 1' . ($lock ? ' FOR UPDATE' : '')
        );
        $stmt->execute(['club_id' => $clubId]);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    /**
     * Adds $days, counted from the current expiry while it is still in the
     * future (renewing early doesn't cost the club its remaining days), else
     * from now. Returns the new expiry.
     */
    public static function extend(PDO $pdo, string $clubId, int $days, ?string $planName): string
    {
        $current = self::latest($pdo, $clubId, true);
        $base = ($current !== null && strtotime($current['expires_at']) > time())
            ? (int) strtotime($current['expires_at'])
            : time();
        $expiresAt = date('Y-m-d H:i:s', (int) strtotime('+' . $days . ' days', $base));

        self::write($pdo, $clubId, $current, $planName ?? ($current['plan_name'] ?? 'اشتراک'), $expiresAt, $current === null || strtotime($current['expires_at']) <= time());

        return $expiresAt;
    }

    /** Puts the expiry (and plan name) at exactly what the admin chose. */
    public static function set(PDO $pdo, string $clubId, string $planName, string $expiresAt): void
    {
        $current = self::latest($pdo, $clubId, true);
        self::write($pdo, $clubId, $current, $planName, $expiresAt, false);
    }

    /**
     * @param array{id: string, plan_name: string, expires_at: string}|null $current
     * @param bool $restart a lapsed or new subscription starts counting today
     */
    private static function write(PDO $pdo, string $clubId, ?array $current, string $planName, string $expiresAt, bool $restart): void
    {
        $status = self::status($expiresAt) ?? 'expired';

        if ($current === null) {
            $pdo->prepare(
                'INSERT INTO subscriptions (id, club_id, plan_name, status, expires_at)
                 VALUES (:id, :club_id, :plan_name, :status, :expires_at)'
            )->execute([
                'id'         => Uuid::v4(),
                'club_id'    => $clubId,
                'plan_name'  => $planName,
                'status'     => $status,
                'expires_at' => $expiresAt,
            ]);
            return;
        }

        $pdo->prepare(
            'UPDATE subscriptions SET plan_name = :plan_name, status = :status, expires_at = :expires_at'
            . ($restart ? ', started_at = :started_at' : '') . ' WHERE id = :id'
        )->execute([
            'plan_name'  => $planName,
            'status'     => $status,
            'expires_at' => $expiresAt,
            'id'         => $current['id'],
        ] + ($restart ? ['started_at' => date('Y-m-d H:i:s')] : []));
    }
}
