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
 * What a plan allows, and what happens when it ends, is Limits; nothing
 * blocks anyone until the admin switches enforcement on (billing settings,
 * trainer_enforce). A trainer who belongs to a club is covered by the club's
 * subscription for the athletes they coach there.
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

    /** @return array{plan_name: string, max_athletes: ?int, started_at: string, expires_at: ?string, status: string, remaining_days: ?int}|null */
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
            // No expiry: the free plan, which is always running.
            'status'         => Subscriptions::status($row['expires_at']) ?? 'active',
            'remaining_days' => Subscriptions::remainingDays($row['expires_at']),
        ];
    }

    /**
     * Adds $days to the trainer's subscription and returns the new expiry.
     * The same plan counts from the current expiry while it is still
     * running (renewing early costs nothing); a different plan starts now
     * with its full period, the old plan's remaining days not carried over.
     * $planId null keeps the trainer's plan (gift days). A plan change drops
     * an admin's override; any renewal brings back athletes suspended when
     * the last plan ended. Call inside a transaction.
     */
    public static function extend(PDO $pdo, string $trainerId, int $days, string $planName, ?int $maxAthletes, ?string $planId = null): string
    {
        $ready = Limits::ready();
        $stmt = $pdo->prepare(
            'SELECT expires_at, ' . ($ready ? 'plan_id' : 'NULL AS plan_id') . ' FROM trainer_subscriptions WHERE trainer_id = :id FOR UPDATE'
        );
        $stmt->execute(['id' => $trainerId]);
        $current = $stmt->fetch();

        $running = $current !== false && $current['expires_at'] !== null && strtotime((string) $current['expires_at']) > time();
        $samePlan = $planId === null || ($current !== false && $current['plan_id'] === $planId);
        $continue = $running && $samePlan;
        $base = $continue ? (int) strtotime((string) $current['expires_at']) : time();
        $expiresAt = date('Y-m-d H:i:s', (int) strtotime('+' . $days . ' days', $base));

        $pdo->prepare(
            'INSERT INTO trainer_subscriptions (trainer_id, ' . ($ready ? 'plan_id, ' : '') . 'plan_name, max_athletes, started_at, expires_at)
             VALUES (:id, ' . ($ready ? ':plan_id, ' : '') . ':plan, :cap, NOW(), :expires)
             ON DUPLICATE KEY UPDATE plan_name = VALUES(plan_name), max_athletes = VALUES(max_athletes),
                                     expires_at = VALUES(expires_at)'
            . ($continue ? '' : ', started_at = NOW()')
            . ($ready && $planId !== null ? ', plan_id = VALUES(plan_id)' : '')
            . ($ready && !$samePlan ? ', override_on = 0, override_max_athletes = NULL' : '')
            // A new expiry earns its own reminders.
            . (self::remindersReady() ? ', reminder_stage = 0' : '')
        )->execute(['id' => $trainerId, 'plan' => $planName, 'cap' => $maxAthletes, 'expires' => $expiresAt]
            + ($ready ? ['plan_id' => $planId ?? ($current['plan_id'] ?? null)] : []));

        if ($ready) {
            Limits::restore($pdo, $trainerId);
            Limits::resync($pdo, $trainerId);
        }

        return $expiresAt;
    }

    /** False until trainer-billing-extras-update.sql has been run on this database. */
    public static function remindersReady(): bool
    {
        return Database::hasColumn('trainer_subscriptions', 'reminder_stage');
    }

    /**
     * Tells trainers their subscription is about to end (once, from the
     * "running out" window in the billing settings) and that it has ended
     * (once). Each notice is sent once per expiry: extending the
     * subscription starts over. Trainers who belong to a club are skipped,
     * the club's subscription covers them. Returns how many of each.
     *
     * @return array{expiring: int, expired: int}
     */
    public static function sendReminders(PDO $pdo): array
    {
        $sent = ['expiring' => 0, 'expired' => 0];
        if (!self::ready() || !self::remindersReady()) {
            return $sent;
        }

        $window = (int) Settings::get('billing')['expiring_days'];
        $due = $pdo->prepare(
            "SELECT s.trainer_id, s.expires_at, s.reminder_stage FROM trainer_subscriptions s
             JOIN profiles p ON p.id = s.trainer_id AND p.account_type = 'trainer' AND p.is_suspended = 0
             WHERE ((s.reminder_stage < 1 AND s.expires_at > NOW() AND s.expires_at <= :soon)
                 OR (s.reminder_stage < 2 AND s.expires_at <= NOW()))
               AND NOT EXISTS (SELECT 1 FROM memberships m
                               WHERE m.user_id = s.trainer_id AND m.role = 'trainer' AND m.status = 'active')"
        );
        $due->execute(['soon' => date('Y-m-d H:i:s', time() + $window * 86400)]);

        foreach ($due->fetchAll() as $row) {
            $expired = strtotime($row['expires_at']) <= time();
            // Claim the notice first: a second run must not send it again.
            $stage = $expired ? 2 : 1;
            $claim = $pdo->prepare(
                'UPDATE trainer_subscriptions SET reminder_stage = :stage WHERE trainer_id = :id AND reminder_stage < :below'
            );
            $claim->execute(['stage' => $stage, 'below' => $stage, 'id' => $row['trainer_id']]);
            if ($claim->rowCount() === 0) {
                continue;
            }

            Templates::notify(
                $pdo,
                $expired ? 'trainer_subscription_expired' : 'trainer_subscription_expiring',
                $row['trainer_id'],
                null,
                'broadcast',
                [
                    'date' => Jalali::format($row['expires_at'], true),
                    'days' => (string) max(1, (int) ceil((strtotime($row['expires_at']) - time()) / 86400)),
                    'grace_date' => Jalali::format((string) Subscriptions::graceEndsAt($row['expires_at']), true),
                ],
                '/subscription'
            );
            $sent[$expired ? 'expired' : 'expiring']++;
        }

        return $sent;
    }

    /**
     * sendReminders at most once every few hours, for the requests that reach
     * the host before (or without) its cron job. Never throws.
     */
    public static function remindIfDue(PDO $pdo): void
    {
        try {
            $stmt = $pdo->prepare('SELECT value FROM app_settings WHERE setting_key = :key');
            $stmt->execute(['key' => 'cron.trainer-subscription-reminders']);
            $last = json_decode((string) $stmt->fetchColumn(), true);
            if (is_array($last) && isset($last['at']) && strtotime((string) $last['at']) > time() - 6 * 3600) {
                return;
            }
            $sent = self::sendReminders($pdo);
            CronHeartbeat::record('trainer-subscription-reminders', self::reminderSummary($sent));
        } catch (\Throwable $e) {
            error_log('trainer reminders: ' . $e->getMessage());
        }
    }

    /** @param array{expiring: int, expired: int} $sent */
    public static function reminderSummary(array $sent): string
    {
        return "trainer reminders: {$sent['expiring']} ending soon, {$sent['expired']} expired";
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
     * Once plan-limits-update.sql has run this is Limits' job; the rule below
     * is the one from before it, for the days between the backend upload and
     * running the database update.
     */
    public static function inviteBlock(PDO $pdo, string $trainerId): ?string
    {
        if (Limits::ready() || !Settings::get('billing')['trainer_enforce'] || !self::ready() || self::inClub($pdo, $trainerId)) {
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
