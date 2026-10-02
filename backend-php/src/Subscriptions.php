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

    /**
     * 'active' | 'expiring' | 'grace' | 'expired', or null for no expiry
     * (no subscription, or the trainers' free plan, which never ends).
     * 'grace' is the billing settings' grace days after the end, during
     * which a platform subscription still works as before; pass
     * $grace = false for anything else that ends (a club membership).
     */
    public static function status(?string $expiresAt, bool $grace = true): ?string
    {
        if ($expiresAt === null || $expiresAt === '') {
            return null;
        }
        $expires = strtotime($expiresAt);
        if ($expires === false) {
            return 'expired';
        }
        if ($expires <= time()) {
            return $grace && $expires + self::graceDays() * 86400 > time() ? 'grace' : 'expired';
        }
        $days = Settings::get('billing')['expiring_days'];
        return $expires <= time() + $days * 86400 ? 'expiring' : 'active';
    }

    public static function graceDays(): int
    {
        return (int) (Settings::get('billing')['grace_days'] ?? 7);
    }

    /** When the grace days after $expiresAt run out. */
    public static function graceEndsAt(?string $expiresAt): ?string
    {
        if ($expiresAt === null || $expiresAt === '' || strtotime($expiresAt) === false) {
            return null;
        }
        return date('Y-m-d H:i:s', (int) strtotime($expiresAt) + self::graceDays() * 86400);
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

    /** @return array{id: string, plan_id: ?string, plan_name: string, started_at: string, expires_at: string}|null */
    public static function latest(PDO $pdo, string $clubId, bool $lock = false): ?array
    {
        $stmt = $pdo->prepare(
            'SELECT id, ' . (Limits::ready() ? 'plan_id' : 'NULL AS plan_id') . ', plan_name, started_at, expires_at
             FROM subscriptions WHERE club_id = :club_id ORDER BY expires_at DESC LIMIT 1' . ($lock ? ' FOR UPDATE' : '')
        );
        $stmt->execute(['club_id' => $clubId]);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    /**
     * Adds $days to the club's subscription and returns the new expiry.
     * Renewing the same plan counts from the current expiry while it is
     * still running (renewing early doesn't cost the club its remaining
     * days). A different plan starts today with its full period, and the
     * remaining days of the old one are not carried over. $planId null keeps
     * the club's plan (gift days).
     */
    public static function extend(PDO $pdo, string $clubId, int $days, ?string $planName, ?string $planId = null): string
    {
        $current = self::latest($pdo, $clubId, true);
        $running = $current !== null && strtotime($current['expires_at']) > time();
        $samePlan = $planId === null || ($current !== null && $current['plan_id'] === $planId);
        $base = ($running && $samePlan) ? (int) strtotime($current['expires_at']) : time();
        $expiresAt = date('Y-m-d H:i:s', (int) strtotime('+' . $days . ' days', $base));

        self::write(
            $pdo,
            $clubId,
            $current,
            $planName ?? ($current['plan_name'] ?? 'اشتراک'),
            $planId ?? ($current['plan_id'] ?? null),
            ($running && $samePlan) ? null : date('Y-m-d H:i:s'),
            $expiresAt,
            !$samePlan
        );

        return $expiresAt;
    }

    /**
     * Puts the subscription exactly where the admin chose. $startedAt null
     * keeps the current start; $planId null keeps the current plan.
     */
    public static function set(
        PDO $pdo,
        string $clubId,
        string $planName,
        string $expiresAt,
        ?string $planId = null,
        ?string $startedAt = null,
        bool $clearOverride = false
    ): void {
        $current = self::latest($pdo, $clubId, true);
        self::write($pdo, $clubId, $current, $planName, $planId ?? ($current['plan_id'] ?? null), $startedAt, $expiresAt, $clearOverride);
    }

    /**
     * @param array{id: string, plan_id: ?string, plan_name: string, expires_at: string}|null $current
     * @param string|null $startedAt null keeps the current start (a new row starts now)
     */
    private static function write(
        PDO $pdo,
        string $clubId,
        ?array $current,
        string $planName,
        ?string $planId,
        ?string $startedAt,
        string $expiresAt,
        bool $clearOverride
    ): void {
        $ready = Limits::ready();
        $status = self::status($expiresAt) ?? 'expired';
        // 'grace' only exists in the column once plan-limits-update.sql ran.
        if ($status === 'grace' && !$ready) {
            $status = 'expired';
        }

        if ($current === null) {
            $row = [
                'id'         => Uuid::v4(),
                'club_id'    => $clubId,
                'plan_name'  => $planName,
                'status'     => $status,
                'started_at' => $startedAt ?? date('Y-m-d H:i:s'),
                'expires_at' => $expiresAt,
            ] + ($ready ? ['plan_id' => $planId] : []);
            $pdo->prepare(
                'INSERT INTO subscriptions (' . implode(', ', array_keys($row)) . ')
                 VALUES (:' . implode(', :', array_keys($row)) . ')'
            )->execute($row);
            return;
        }

        $sets = ['plan_name = :plan_name', 'status = :status', 'expires_at = :expires_at'];
        $bind = ['plan_name' => $planName, 'status' => $status, 'expires_at' => $expiresAt, 'id' => $current['id']];
        if ($startedAt !== null) {
            $sets[] = 'started_at = :started_at';
            $bind['started_at'] = $startedAt;
        }
        if ($ready) {
            $sets[] = 'plan_id = :plan_id';
            $bind['plan_id'] = $planId;
            if ($clearOverride) {
                $sets[] = 'override_on = 0, override_max_members = NULL, override_max_trainers = NULL';
            }
        }
        $pdo->prepare('UPDATE subscriptions SET ' . implode(', ', $sets) . ' WHERE id = :id')->execute($bind);
    }
}
