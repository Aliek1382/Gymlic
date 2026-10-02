<?php
declare(strict_types=1);

namespace Gymlic;

use PDO;

/**
 * What a trainer's or a club's plan allows, and the one place that says so:
 * every cap check on the server reads it from here (forTrainer / forClub),
 * never from the browser.
 *
 * Trainer: every trainer has a plan. Without a paid one it is the free plan
 * (trainer_plans.is_free), which never expires; a trainer needs no row in
 * trainer_subscriptions for it. A paid plan runs to expires_at, then the
 * grace days (billing settings), during which everything works as before;
 * after that the trainer is on the free plan again. The athletes above the
 * free cap are then suspended (trainer_athletes.suspended_by_plan) — once,
 * on the first request that looks at the trainer, since there is no cron —
 * and all come back the moment the plan is renewed. A suspended athlete
 * stays linked and readable (plans, data, exports) but gets no new plans,
 * edits or messages. The trainer may pick who stays active
 * (keep_on_downgrade); otherwise the most recently seen ones do.
 *
 * Only athletes a trainer coaches outside a club (club_id NULL) count
 * against the trainer's plan. An invite a club trainer sends carries the
 * club, and counts against the club's member cap instead.
 *
 * Club: no free plan. Its plan caps members and trainers; after its grace
 * days a club can't invite anyone new, and nobody is suspended.
 *
 * An admin may override a cap on one subscription (override_on). The
 * override goes when the plan changes, and stops counting once the grace
 * days are over.
 *
 * Enforcement (blocking, suspending) waits for the billing setting
 * trainer_enforce, and for plan-limits-update.sql; until then the caps are
 * only shown. The one check that predates this, a club's member cap when its
 * manager invites, keeps running either way.
 */
final class Limits
{
    public const FEATURE_KEYS = ['max_custom_exercises', 'max_templates', 'history_months', 'report_level'];

    private static ?bool $ready = null;

    /** @var array<string, true> trainers whose suspension state was settled in this request */
    private static array $synced = [];

    /** @var array<string, mixed>|null */
    private static ?array $freePlan = null;

    private function __construct()
    {
    }

    /** False until plan-limits-update.sql has been run on this database. */
    public static function ready(): bool
    {
        return self::$ready ??= TrainerBilling::ready()
            && Database::hasColumn('plans', 'max_trainers')
            && Database::hasColumn('trainer_plans', 'is_free')
            && Database::hasColumn('subscriptions', 'override_on')
            && Database::hasColumn('trainer_subscriptions', 'downgrade_applied_at')
            && Database::hasColumn('trainer_athletes', 'suspended_by_plan');
    }

    /** Whether the caps are enforced: the admin's switch, once the database is ready. */
    public static function enforcing(): bool
    {
        return self::ready() && (bool) Settings::get('billing')['trainer_enforce'];
    }

    // ---- Trainer ---------------------------------------------------------

    /**
     * The trainer's own plan as it stands now.
     *
     * status: 'active' | 'expiring' | 'grace' | 'expired'. 'expired' means a
     * paid plan ended and its grace days too, so the free plan applies; the
     * free plan itself is always 'active'.
     *
     * @return array<string, mixed>
     */
    public static function forTrainer(PDO $pdo, string $trainerId): array
    {
        if (!self::ready()) {
            return self::legacyTrainer($pdo, $trainerId);
        }
        self::syncTrainer($pdo, $trainerId);

        $stmt = $pdo->prepare('SELECT ' . self::TRAINER_COLUMNS . ' ' . self::TRAINER_JOIN . ' WHERE s.trainer_id = :id');
        $stmt->execute(['id' => $trainerId]);
        $row = $stmt->fetch();

        return self::trainerShape(
            $pdo,
            $row === false ? null : $row,
            self::trainerUsage($pdo, $trainerId),
            self::trainerClub($pdo, $trainerId)
        );
    }

    /** The subscription columns trainerShape reads, with TRAINER_JOIN. */
    public const TRAINER_COLUMNS = 's.plan_id, s.plan_name, s.max_athletes AS row_max_athletes, s.started_at, s.expires_at,
        s.override_on, s.override_max_athletes, s.downgrade_applied_at,
        p.name AS p_name, p.max_athletes, p.is_free,
        p.max_custom_exercises, p.max_templates, p.history_months, p.report_level';

    public const TRAINER_JOIN = 'FROM trainer_subscriptions s LEFT JOIN trainer_plans p ON p.id = s.plan_id';

    /**
     * forTrainer from an already-read subscription row (null = none), for
     * lists that read every trainer at once.
     *
     * @param array<string, mixed>|null $row
     * @param array{active: int, pending_invites: int, suspended: int} $usage
     * @param array{club_id: string, name: string}|null $club
     * @return array<string, mixed>
     */
    public static function trainerShape(PDO $pdo, ?array $row, array $usage, ?array $club): array
    {
        $free = self::freePlan($pdo);
        $plan = $free;
        $status = 'active';
        $override = false;
        $subscription = null;

        if ($row !== null && ($row['plan_id'] !== null || $row['expires_at'] !== null)) {
            $isFree = (int) ($row['is_free'] ?? 0) === 1 || $row['expires_at'] === null;
            $status = $isFree ? 'active' : (string) Subscriptions::status($row['expires_at']);
            $subscription = [
                'plan_id'        => $row['plan_id'],
                'plan_name'      => $row['p_name'] ?? $row['plan_name'],
                'is_free'        => $isFree,
                'started_at'     => $row['started_at'],
                'expires_at'     => $row['expires_at'],
                'remaining_days' => Subscriptions::remainingDays($row['expires_at']),
                'grace_ends_at'  => $isFree ? null : Subscriptions::graceEndsAt($row['expires_at']),
                'override_on'    => (int) $row['override_on'] === 1,
                'override_max_athletes' => self::intOrNull($row['override_max_athletes']),
                'downgraded'     => $row['downgrade_applied_at'] !== null,
            ];

            if ($status !== 'expired') {
                if ($row['p_name'] !== null) {
                    $plan = self::planShape($row, $row['plan_id'], $row['p_name']);
                } else {
                    // A subscription bought before plans had ids: its own name and cap.
                    $plan = ['id' => null, 'name' => $row['plan_name'], 'is_free' => false,
                             'max_athletes' => self::intOrNull($row['row_max_athletes'])]
                          + array_fill_keys(self::FEATURE_KEYS, null);
                }
                $override = (int) $row['override_on'] === 1;
            }
        }

        $cap = $override ? $subscription['override_max_athletes'] : $plan['max_athletes'];
        $enforcing = self::enforcing();
        // While a paid plan (or its grace days) still runs: how many would
        // be suspended once it ends, at today's numbers.
        $atRisk = 0;
        if ($enforcing && $subscription !== null && !$subscription['is_free'] && $status !== 'expired' && $free['max_athletes'] !== null) {
            $atRisk = max(0, $usage['active'] + $usage['suspended'] - $free['max_athletes']);
        }

        return [
            'ready'        => true,
            'enforcing'    => $enforcing,
            'plan'         => $plan,
            'status'       => $status,
            'subscription' => $subscription,
            'override'     => $override,
            'max_athletes' => $cap,
            'free_max_athletes' => $free['max_athletes'],
            'usage'        => $usage,
            'over_cap'     => $cap !== null && $usage['active'] > $cap,
            'suspend_after_grace' => $atRisk,
            'club'         => $club,
        ];
    }

    /** The free trainer plan (the first one, should the admin ever add another). @return array<string, mixed> */
    public static function freePlan(PDO $pdo): array
    {
        if (self::$freePlan === null) {
            $row = $pdo->query(
                'SELECT id, name, max_athletes, is_free, max_custom_exercises, max_templates, history_months, report_level
                 FROM trainer_plans WHERE is_free = 1 ORDER BY created_at ASC LIMIT 1'
            )->fetch();
            self::$freePlan = $row === false
                // Never deleted (TrainerBillingController refuses), but don't fall over if it was.
                ? ['id' => null, 'name' => 'رایگان', 'is_free' => true, 'max_athletes' => 3] + array_fill_keys(self::FEATURE_KEYS, null)
                : self::planShape($row, $row['id'], $row['name']);
        }
        return self::$freePlan;
    }

    /** @return array{active: int, pending_invites: int, suspended: int} */
    public static function trainerUsage(PDO $pdo, string $trainerId): array
    {
        $links = $pdo->prepare(
            "SELECT COALESCE(SUM(suspended_by_plan = 0), 0) AS active, COALESCE(SUM(suspended_by_plan = 1), 0) AS suspended
             FROM trainer_athletes WHERE trainer_id = :id AND club_id IS NULL AND status = 'active'"
        );
        $links->execute(['id' => $trainerId]);
        $counts = $links->fetch();

        $pending = $pdo->prepare(
            "SELECT COUNT(*) FROM invitations
             WHERE trainer_id = :id AND club_id IS NULL AND invited_role = 'athlete'
               AND status = 'pending' AND expires_at > NOW()"
        );
        $pending->execute(['id' => $trainerId]);

        return [
            'active'          => (int) $counts['active'],
            'pending_invites' => (int) $pending->fetchColumn(),
            'suspended'       => (int) $counts['suspended'],
        ];
    }

    /** The club an invite from this trainer carries: their first active trainer membership. @return array{club_id: string, name: string}|null */
    public static function trainerClub(PDO $pdo, string $trainerId): ?array
    {
        $stmt = $pdo->prepare(
            "SELECT m.club_id, c.name
             FROM memberships m
             JOIN clubs c ON c.id = m.club_id
             WHERE m.user_id = :user_id AND m.role = 'trainer' AND m.status = 'active'
             ORDER BY m.joined_at ASC LIMIT 1"
        );
        $stmt->execute(['user_id' => $trainerId]);

        return $stmt->fetch() ?: null;
    }

    // ---- Club ------------------------------------------------------------

    /**
     * The club's plan as it stands now. status is null for a club that has
     * never had a subscription; can_invite is false (while enforcing) once a
     * subscription's grace days are over, or when there never was one.
     *
     * @return array<string, mixed>
     */
    public static function forClub(PDO $pdo, string $clubId): array
    {
        $ready = self::ready();
        $stmt = $pdo->prepare(
            'SELECT ' . ($ready ? self::CLUB_COLUMNS : 'c.member_capacity, s.plan_name, s.started_at, s.expires_at') . '
             FROM clubs c LEFT JOIN subscriptions s ON s.club_id = c.id'
            . ($ready ? ' LEFT JOIN plans p ON p.id = s.plan_id' : '') . '
             WHERE c.id = :id ORDER BY s.expires_at DESC LIMIT 1'
        );
        $stmt->execute(['id' => $clubId]);
        $row = $stmt->fetch();

        return self::clubShape($row === false ? [] : $row, self::clubUsage($pdo, $clubId));
    }

    /** The columns clubShape reads (clubs c, subscriptions s, plans p). */
    public const CLUB_COLUMNS = 'c.member_capacity, s.plan_name, s.started_at, s.expires_at,
        s.plan_id, s.override_on, s.override_max_members, s.override_max_trainers,
        p.name AS p_name, p.max_members, p.max_trainers';

    /**
     * forClub from an already-read row, for lists.
     *
     * @param array<string, mixed> $row
     * @param array{members: int, pending_member_invites: int, trainers: int, pending_trainer_invites: int} $usage
     * @return array<string, mixed>
     */
    public static function clubShape(array $row, array $usage): array
    {
        $ready = self::ready();
        $row += ['member_capacity' => null, 'plan_name' => null, 'started_at' => null, 'expires_at' => null];

        $status = Subscriptions::status($row['expires_at']);
        $hasPlan = $ready && ($row['p_name'] ?? null) !== null;
        $maxMembers = $hasPlan ? self::intOrNull($row['max_members']) : self::intOrNull($row['member_capacity']);
        $maxTrainers = $hasPlan ? self::intOrNull($row['max_trainers']) : null;
        $override = $ready && (int) ($row['override_on'] ?? 0) === 1 && $status !== null && $status !== 'expired';
        if ($override) {
            $maxMembers = self::intOrNull($row['override_max_members']);
            $maxTrainers = self::intOrNull($row['override_max_trainers']);
        }
        $enforcing = self::enforcing();
        $running = in_array($status, ['active', 'expiring', 'grace'], true);

        // While enforcement is off, a club with no plan running still gets
        // the free tier's member cap when the admin set one (Tiers).
        $freeCap = Tiers::freeCap('max_members');
        if (!$enforcing && !$running && $freeCap !== null) {
            $maxMembers = $maxMembers === null ? $freeCap : min($maxMembers, $freeCap);
        }

        return [
            'ready'        => $ready,
            'enforcing'    => $enforcing,
            'plan_id'      => $hasPlan ? $row['plan_id'] : null,
            'plan_name'    => $hasPlan ? $row['p_name'] : $row['plan_name'],
            'status'       => $status,
            'started_at'   => $row['started_at'],
            'expires_at'   => $row['expires_at'],
            'remaining_days' => Subscriptions::remainingDays($row['expires_at']),
            'grace_ends_at'  => Subscriptions::graceEndsAt($row['expires_at']),
            'max_members'  => $maxMembers,
            'max_trainers' => $maxTrainers,
            'override'     => $override,
            'override_on'  => $ready && (int) ($row['override_on'] ?? 0) === 1,
            'override_max_members'  => $ready ? self::intOrNull($row['override_max_members'] ?? null) : null,
            'override_max_trainers' => $ready ? self::intOrNull($row['override_max_trainers'] ?? null) : null,
            'can_invite'   => !$enforcing || $running,
            'usage'        => $usage,
            'over_cap'     => ($maxMembers !== null && $usage['members'] > $maxMembers)
                || ($maxTrainers !== null && $usage['trainers'] > $maxTrainers),
        ];
    }

    /** @return array{members: int, pending_member_invites: int, trainers: int, pending_trainer_invites: int} */
    public static function clubUsage(PDO $pdo, string $clubId): array
    {
        $stmt = $pdo->prepare(
            "SELECT
               (SELECT COUNT(*) FROM memberships WHERE club_id = :c1 AND role = 'athlete' AND status = 'active') AS members,
               (SELECT COUNT(*) FROM invitations WHERE club_id = :c2 AND invited_role = 'athlete'
                  AND status = 'pending' AND expires_at > NOW()) AS pending_member_invites,
               (SELECT COUNT(*) FROM memberships WHERE club_id = :c3 AND role = 'trainer') AS trainers,
               (SELECT COUNT(*) FROM invitations WHERE club_id = :c4 AND invited_role = 'trainer'
                  AND status = 'pending' AND expires_at > NOW()) AS pending_trainer_invites"
        );
        $stmt->execute(['c1' => $clubId, 'c2' => $clubId, 'c3' => $clubId, 'c4' => $clubId]);

        return array_map('intval', $stmt->fetch());
    }

    // ---- Checks ----------------------------------------------------------
    // Each returns null when allowed, or [http status, code, message]. Called
    // inside the transaction that creates the invite or accepts it: the
    // trainer's profile row / the club row is locked, so two requests can't
    // both take the last place.

    /** A trainer inviting an athlete; $clubId is the club the invite carries (Limits::trainerClub). */
    public static function athleteInviteBlock(PDO $pdo, string $trainerId, ?string $clubId): ?array
    {
        if ($clubId !== null) {
            return self::enforcing() ? self::clubMemberInviteBlock($pdo, $clubId) : null;
        }
        if (!self::enforcing()) {
            return null;
        }

        self::lock($pdo, 'profiles', $trainerId);
        $limits = self::forTrainer($pdo, $trainerId);
        $cap = $limits['max_athletes'];
        if ($cap !== null && $limits['usage']['active'] + $limits['usage']['pending_invites'] >= $cap) {
            return [402, 'plan_limit', 'پلن «' . $limits['plan']['name'] . '» شما حداکثر ' . self::fa($cap)
                . ' ورزشکار را پوشش می‌دهد (دعوت‌های در انتظار هم حساب می‌شوند) و به سقف رسیده‌اید. برای دعوت بیشتر، پلن خود را ارتقا دهید.'];
        }
        return null;
    }

    /**
     * A club taking another member (its manager, or one of its trainers,
     * inviting). The member cap has always been checked for a manager's
     * invite; an ended subscription only blocks while enforcing.
     */
    public static function clubMemberInviteBlock(PDO $pdo, string $clubId): ?array
    {
        self::lock($pdo, 'clubs', $clubId);
        $limits = self::forClub($pdo, $clubId);
        if (!$limits['can_invite']) {
            return self::clubLapsed();
        }
        $cap = $limits['max_members'];
        if ($cap !== null && $limits['usage']['members'] + $limits['usage']['pending_member_invites'] >= $cap) {
            return [409, 'capacity_full', 'ظرفیت اعضای باشگاه (' . self::fa($cap)
                . ' عضو، با دعوت‌های در انتظار) پر است. برای عضو بیشتر، پلن باشگاه را ارتقا دهید.'];
        }
        return null;
    }

    /** A club inviting a trainer: active, suspended and pending trainers plus open invites count. */
    public static function clubTrainerInviteBlock(PDO $pdo, string $clubId): ?array
    {
        if (!self::enforcing()) {
            return null;
        }
        self::lock($pdo, 'clubs', $clubId);
        $limits = self::forClub($pdo, $clubId);
        if (!$limits['can_invite']) {
            return self::clubLapsed();
        }
        $cap = $limits['max_trainers'];
        if ($cap !== null && $limits['usage']['trainers'] + $limits['usage']['pending_trainer_invites'] >= $cap) {
            return [409, 'trainer_capacity_full', 'پلن باشگاه حداکثر ' . self::fa($cap)
                . ' مربی را پوشش می‌دهد (مربی‌های معلق و دعوت‌های در انتظار هم حساب می‌شوند). برای مربی بیشتر، پلن باشگاه را ارتقا دهید.'];
        }
        return null;
    }

    /**
     * An athlete accepting an invite. The invite was within the cap when it
     * was sent, but the plan may have shrunk since (it ended, or the admin
     * lowered it). Pending invites don't count here: this one is the one
     * being used.
     *
     * @param array<string, mixed> $invite
     */
    public static function acceptAthleteBlock(PDO $pdo, array $invite, string $athleteId): ?array
    {
        if (!self::enforcing()) {
            return null;
        }

        if ($invite['club_id'] !== null) {
            self::lock($pdo, 'clubs', $invite['club_id']);
            $member = $pdo->prepare(
                "SELECT 1 FROM memberships WHERE club_id = :c AND user_id = :u AND role = 'athlete' AND status = 'active'"
            );
            $member->execute(['c' => $invite['club_id'], 'u' => $athleteId]);
            if ($member->fetchColumn() !== false) {
                return null;
            }
            $limits = self::forClub($pdo, $invite['club_id']);
            $cap = $limits['max_members'];
            return $cap !== null && $limits['usage']['members'] >= $cap
                ? [409, 'capacity_full', 'ظرفیت این باشگاه تکمیل است و دعوت دیگر قابل استفاده نیست. با باشگاه تماس بگیرید.']
                : null;
        }

        if ($invite['trainer_id'] === null) {
            return null;
        }
        self::lock($pdo, 'profiles', $invite['trainer_id']);
        $link = $pdo->prepare('SELECT status FROM trainer_athletes WHERE trainer_id = :t AND athlete_id = :a');
        $link->execute(['t' => $invite['trainer_id'], 'a' => $athleteId]);
        if ($link->fetchColumn() === 'active') {
            return null;
        }
        $limits = self::forTrainer($pdo, $invite['trainer_id']);
        $cap = $limits['max_athletes'];
        return $cap !== null && $limits['usage']['active'] >= $cap
            ? [409, 'plan_limit', 'ظرفیت ورزشکاران این مربی تکمیل است و دعوت دیگر قابل استفاده نیست. با مربی خود تماس بگیرید.']
            : null;
    }

    /** A trainer accepting a club's invite. */
    public static function acceptTrainerBlock(PDO $pdo, string $clubId): ?array
    {
        if (!self::enforcing()) {
            return null;
        }
        self::lock($pdo, 'clubs', $clubId);
        $limits = self::forClub($pdo, $clubId);
        $cap = $limits['max_trainers'];
        return $cap !== null && $limits['usage']['trainers'] >= $cap
            ? [409, 'trainer_capacity_full', 'ظرفیت مربی‌های این باشگاه تکمیل است و دعوت دیگر قابل استفاده نیست. با باشگاه تماس بگیرید.']
            : null;
    }

    // ---- Suspension ------------------------------------------------------

    /**
     * Brings the trainer's athletes in line with their plan: suspends the
     * ones above the free cap once a paid plan's grace days are over (once:
     * downgrade_applied_at), and brings everyone back when that no longer
     * holds (renewed, or enforcement switched off). Runs at most once per
     * trainer per request.
     */
    public static function syncTrainer(PDO $pdo, string $trainerId): void
    {
        if (!self::ready() || isset(self::$synced[$trainerId])) {
            return;
        }
        self::$synced[$trainerId] = true;

        $stmt = $pdo->prepare(
            'SELECT s.expires_at, s.downgrade_applied_at, p.is_free
             FROM trainer_subscriptions s LEFT JOIN trainer_plans p ON p.id = s.plan_id
             WHERE s.trainer_id = :id'
        );
        $stmt->execute(['id' => $trainerId]);
        $row = $stmt->fetch();
        if ($row === false) {
            return;
        }

        $ended = $row['expires_at'] !== null
            && (int) ($row['is_free'] ?? 0) !== 1
            && Subscriptions::status($row['expires_at']) === 'expired';

        if ($ended && self::enforcing()) {
            if ($row['downgrade_applied_at'] === null) {
                self::downgrade($pdo, $trainerId);
            }
        } elseif ($row['downgrade_applied_at'] !== null) {
            self::restore($pdo, $trainerId);
        }
    }

    /** Settles the trainer again after a change in this request (a renewal, the admin's edit). */
    public static function resync(PDO $pdo, string $trainerId): void
    {
        unset(self::$synced[$trainerId]);
        self::syncTrainer($pdo, $trainerId);
    }

    /** Suspends the athletes above the free cap, once per ended plan. */
    private static function downgrade(PDO $pdo, string $trainerId): void
    {
        $claim = $pdo->prepare(
            'UPDATE trainer_subscriptions SET downgrade_applied_at = NOW() WHERE trainer_id = :id AND downgrade_applied_at IS NULL'
        );
        $claim->execute(['id' => $trainerId]);
        if ($claim->rowCount() === 0) {
            return;
        }

        $suspended = self::applyKeepList($pdo, $trainerId);
        if ($suspended > 0) {
            try {
                Templates::notify(
                    $pdo,
                    'trainer_athletes_suspended',
                    $trainerId,
                    null,
                    'broadcast',
                    ['count' => self::fa($suspended), 'cap' => self::fa((int) self::freePlan($pdo)['max_athletes'])],
                    '/subscription/athletes'
                );
            } catch (\Throwable $e) {
                error_log('suspended notice: ' . $e->getMessage());
            }
        }
    }

    /**
     * Re-ranks a downgraded trainer's athletes: the ones they picked first,
     * then the most recently seen; the free cap stay active, the rest are
     * suspended. Returns how many are suspended.
     */
    public static function applyKeepList(PDO $pdo, string $trainerId): int
    {
        $cap = self::freePlan($pdo)['max_athletes'];
        $stmt = $pdo->prepare(
            "SELECT ta.id FROM trainer_athletes ta JOIN profiles p ON p.id = ta.athlete_id
             WHERE ta.trainer_id = :id AND ta.club_id IS NULL AND ta.status = 'active'
             ORDER BY ta.keep_on_downgrade DESC, p.last_seen_at IS NULL, p.last_seen_at DESC, ta.created_at DESC"
        );
        $stmt->execute(['id' => $trainerId]);
        $ids = $stmt->fetchAll(PDO::FETCH_COLUMN);

        $set = $pdo->prepare('UPDATE trainer_athletes SET suspended_by_plan = :s WHERE id = :id');
        $suspended = 0;
        foreach ($ids as $i => $id) {
            $off = $cap !== null && $i >= $cap;
            $set->execute(['s' => $off ? 1 : 0, 'id' => $id]);
            $suspended += $off ? 1 : 0;
        }
        return $suspended;
    }

    /** Everyone back, and the next end of a plan suspends afresh. Returns how many came back. */
    public static function restore(PDO $pdo, string $trainerId): int
    {
        $count = self::reactivate($pdo, $trainerId);
        $pdo->prepare('UPDATE trainer_subscriptions SET downgrade_applied_at = NULL WHERE trainer_id = :id')
            ->execute(['id' => $trainerId]);
        return $count;
    }

    /**
     * Everyone back now, without clearing the marker: the admin's
     * "reactivate" on a trainer still on the free plan sticks until the
     * trainer's next paid plan ends.
     */
    public static function reactivate(PDO $pdo, string $trainerId): int
    {
        $stmt = $pdo->prepare('UPDATE trainer_athletes SET suspended_by_plan = 0 WHERE trainer_id = :id AND suspended_by_plan = 1');
        $stmt->execute(['id' => $trainerId]);
        return $stmt->rowCount();
    }

    /** Whether this trainer's link to this athlete is suspended by the plan. */
    public static function isSuspended(PDO $pdo, string $trainerId, string $athleteId): bool
    {
        if (!self::ready()) {
            return false;
        }
        self::syncTrainer($pdo, $trainerId);
        $stmt = $pdo->prepare('SELECT suspended_by_plan FROM trainer_athletes WHERE trainer_id = :t AND athlete_id = :a');
        $stmt->execute(['t' => $trainerId, 'a' => $athleteId]);
        return (int) $stmt->fetchColumn() === 1;
    }

    /** Whether either of the two is the other's suspended athlete (messages are closed both ways). */
    public static function pairSuspended(PDO $pdo, string $a, string $b): bool
    {
        return self::isSuspended($pdo, $a, $b) || self::isSuspended($pdo, $b, $a);
    }

    /** Ends the request with 403 when the trainer may only read this athlete. */
    public static function requireWritable(string $trainerId, ?string $athleteId): void
    {
        if ($athleteId === null || !self::isSuspended(Database::connection(), $trainerId, $athleteId)) {
            return;
        }
        Response::error(
            403,
            'athlete_suspended_by_plan',
            'این ورزشکار به‌خاطر پایان اشتراک شما غیرفعال است و اطلاعاتش فقط‌خواندنی است. با تمدید اشتراک، یا انتخاب او در «اشتراک من ← ورزشکاران فعال»، دوباره فعال می‌شود.'
        );
        exit;
    }

    // ---- Helpers ---------------------------------------------------------

    /** @return array<string, mixed> */
    private static function legacyTrainer(PDO $pdo, string $trainerId): array
    {
        $subscription = TrainerBilling::ready() ? TrainerBilling::subscription($pdo, $trainerId) : null;
        $counts = TrainerBilling::athleteCounts($pdo, $trainerId);

        return [
            'ready'        => false,
            'enforcing'    => false,
            'plan'         => ['id' => null, 'name' => $subscription['plan_name'] ?? null, 'is_free' => false,
                               'max_athletes' => $subscription['max_athletes'] ?? null] + array_fill_keys(self::FEATURE_KEYS, null),
            'status'       => $subscription['status'] ?? null,
            'subscription' => $subscription,
            'override'     => false,
            'max_athletes' => $subscription['max_athletes'] ?? null,
            'free_max_athletes' => null,
            'usage'        => $counts + ['suspended' => 0],
            'over_cap'     => false,
            'suspend_after_grace' => 0,
            'club'         => self::trainerClub($pdo, $trainerId),
        ];
    }

    /** @return array<string, mixed> */
    private static function planShape(array $row, ?string $id, string $name): array
    {
        $plan = [
            'id'           => $id,
            'name'         => $name,
            'is_free'      => (int) ($row['is_free'] ?? 0) === 1,
            'max_athletes' => self::intOrNull($row['max_athletes']),
        ];
        foreach (self::FEATURE_KEYS as $key) {
            $plan[$key] = $key === 'report_level' ? ($row[$key] ?? null) : self::intOrNull($row[$key] ?? null);
        }
        return $plan;
    }

    private static function lock(PDO $pdo, string $table, string $id): void
    {
        if ($pdo->inTransaction()) {
            $pdo->prepare("SELECT id FROM {$table} WHERE id = :id FOR UPDATE")->execute(['id' => $id]);
        }
    }

    /** @return array{0: int, 1: string, 2: string} */
    private static function clubLapsed(): array
    {
        return [402, 'club_plan_required', 'اشتراک باشگاه فعال نیست. برای دعوت عضو یا مربی تازه، اشتراک باشگاه را تهیه یا تمدید کنید.'];
    }

    private static function intOrNull(mixed $value): ?int
    {
        return $value === null || $value === '' ? null : (int) $value;
    }

    private static function fa(int $n): string
    {
        return strtr((string) $n, ['0' => '۰', '1' => '۱', '2' => '۲', '3' => '۳', '4' => '۴', '5' => '۵', '6' => '۶', '7' => '۷', '8' => '۸', '9' => '۹']);
    }
}
