<?php
declare(strict_types=1);

namespace Gymlic;

use PDO;

/**
 * A trainer's own subscription to the platform: one row per trainer in
 * `trainer_subscriptions`, bought with card-to-card payments reviewed by an
 * admin (TrainerBillingController). Clubs have the equivalent in
 * Subscriptions; the expiry arithmetic is shared with it.
 *
 * Nothing here blocks anyone until the admin switches enforcement on
 * (billing settings, trainer_enforce). Then a trainer working outside a club
 * needs an active plan, within its athlete cap, to invite new athletes;
 * athletes they already have are never taken away. A trainer who belongs to a
 * club is covered by the club's subscription and is never asked to pay.
 */
final class TrainerBilling
{
    private function __construct()
    {
    }

    /** False until trainer-billing-update.sql has been run on this database. */
    public static function ready(): bool
    {
        return Database::hasTable('trainer_plans')
            && Database::hasTable('trainer_subscriptions')
            && Database::hasTable('trainer_payment_requests');
    }

    /** @return array{plan_name: string, max_athletes: ?int, started_at: string, expires_at: string, status: string, remaining_days: int}|null */
    public static function subscription(PDO $pdo, string $trainerId): ?array
    {
        $stmt = $pdo->prepare(
            'SELECT plan_name, max_athletes, started_at, expires_at FROM trainer_subscriptions WHERE trainer_id = :id'
        );
        $stmt->execute(['id' => $trainerId]);
        $row = $stmt->fetch();
        if ($row === false) {
            return null;
        }

        return [
            'plan_name'      => $row['plan_name'],
            'max_athletes'   => $row['max_athletes'] === null ? null : (int) $row['max_athletes'],
            'started_at'     => $row['started_at'],
            'expires_at'     => $row['expires_at'],
            'status'         => (string) Subscriptions::status($row['expires_at']),
            'remaining_days' => (int) Subscriptions::remainingDays($row['expires_at']),
        ];
    }

    /**
     * Adds $days to the trainer's subscription, counted from the current
     * expiry while it is still running (renewing early costs nothing), else
     * from now, and takes the plan's name and athlete cap. Returns the new
     * expiry. Call inside a transaction.
     */
    public static function extend(PDO $pdo, string $trainerId, int $days, string $planName, ?int $maxAthletes): string
    {
        $stmt = $pdo->prepare('SELECT expires_at FROM trainer_subscriptions WHERE trainer_id = :id FOR UPDATE');
        $stmt->execute(['id' => $trainerId]);
        $current = $stmt->fetchColumn();

        $running = $current !== false && strtotime((string) $current) > time();
        $base = $running ? (int) strtotime((string) $current) : time();
        $expiresAt = date('Y-m-d H:i:s', (int) strtotime('+' . $days . ' days', $base));

        $pdo->prepare(
            'INSERT INTO trainer_subscriptions (trainer_id, plan_name, max_athletes, started_at, expires_at)
             VALUES (:id, :plan, :cap, NOW(), :expires)
             ON DUPLICATE KEY UPDATE plan_name = VALUES(plan_name), max_athletes = VALUES(max_athletes),
                                     expires_at = VALUES(expires_at)'
            . ($running ? '' : ', started_at = NOW()')
        )->execute(['id' => $trainerId, 'plan' => $planName, 'cap' => $maxAthletes, 'expires' => $expiresAt]);

        return $expiresAt;
    }

    /** Whether the trainer belongs to a club (and so is covered by the club's subscription). */
    public static function inClub(PDO $pdo, string $trainerId): bool
    {
        $stmt = $pdo->prepare(
            "SELECT 1 FROM memberships WHERE user_id = :id AND role = 'trainer' AND status = 'active' LIMIT 1"
        );
        $stmt->execute(['id' => $trainerId]);

        return $stmt->fetchColumn() !== false;
    }

    /** @return array{active: int, pending_invites: int} */
    public static function athleteCounts(PDO $pdo, string $trainerId): array
    {
        $active = $pdo->prepare("SELECT COUNT(*) FROM trainer_athletes WHERE trainer_id = :id AND status = 'active'");
        $active->execute(['id' => $trainerId]);
        $pending = $pdo->prepare(
            "SELECT COUNT(*) FROM invitations
             WHERE trainer_id = :id AND invited_role = 'athlete' AND status = 'pending' AND expires_at > NOW()"
        );
        $pending->execute(['id' => $trainerId]);

        return ['active' => (int) $active->fetchColumn(), 'pending_invites' => (int) $pending->fetchColumn()];
    }

    /**
     * Why this trainer may not invite another athlete right now, in words for
     * the trainer; null when they may (including whenever enforcement is off).
     */
    public static function inviteBlock(PDO $pdo, string $trainerId): ?string
    {
        if (!Settings::get('billing')['trainer_enforce'] || !self::ready() || self::inClub($pdo, $trainerId)) {
            return null;
        }

        $subscription = self::subscription($pdo, $trainerId);
        if ($subscription === null || $subscription['status'] === 'expired') {
            return 'برای دعوت ورزشکار تازه، اشتراک شما باید فعال باشد. از صفحهٔ «اشتراک من» اشتراک تهیه یا تمدید کنید.';
        }

        $cap = $subscription['max_athletes'];
        if ($cap !== null) {
            $counts = self::athleteCounts($pdo, $trainerId);
            if ($counts['active'] + $counts['pending_invites'] >= $cap) {
                return "پلن شما حداکثر {$cap} ورزشکار را پوشش می‌دهد و به سقف رسیده‌اید. برای دعوت بیشتر، پلن بالاتری تهیه کنید.";
            }
        }

        return null;
    }
}
