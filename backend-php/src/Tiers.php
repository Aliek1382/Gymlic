<?php
declare(strict_types=1);

namespace Gymlic;

use PDO;
use Throwable;

/**
 * Free / silver / gold / diamond. Every club plan and trainer plan carries a
 * tier (tiers-update.sql), and a subscription takes its plan's tier when it
 * is bought, approved or renewed. The plan still sets its own limits
 * (members, athletes) and length; the tier says which panel sections are
 * open, as the admin set in the "tiers" settings group (/admin/tiers).
 *
 * Whose tier counts:
 *   - a trainer: their own running subscription; else, in a club, the club's;
 *     else free.
 *   - a club owner: the club's running subscription; else free.
 *   - an athlete: their trainer's (so a section their trainer's plan doesn't
 *     open is closed for them too); else their club's; else free.
 * A running subscription with no tier yet (bought before tiers existed)
 * is never limited, and neither is anyone before the SQL has run. Admins
 * never are.
 *
 * Free-tier caps (athletes per trainer, members per club) apply only to
 * those with no running subscription; a plan's own cap applies otherwise.
 *
 * On top of all this, the admin may set one trainer's or club's access by
 * hand (AccountAccess): a fixed tier, which wins over the subscription's,
 * and sections switched on or off one by one, which win over the tier.
 */
final class Tiers
{
    public const KEYS = ['free', 'silver', 'gold', 'diamond'];

    public const LABELS = ['free' => 'رایگان', 'silver' => 'نقره‌ای', 'gold' => 'طلایی', 'diamond' => 'الماسی'];

    /** @var array<string, ?string> per-request cache: user id => effective tier */
    private static array $cache = [];

    private function __construct()
    {
    }

    /** False until tiers-update.sql has run. */
    public static function ready(): bool
    {
        return Database::hasColumn('subscriptions', 'tier') && Database::hasColumn('trainer_subscriptions', 'tier')
            && Database::hasColumn('plans', 'tier') && Database::hasColumn('trainer_plans', 'tier');
    }

    public static function valid(mixed $tier): bool
    {
        return is_string($tier) && in_array($tier, self::KEYS, true);
    }

    public static function label(?string $tier): string
    {
        if ($tier === null) {
            return 'بدون سطح';
        }
        return Settings::get('tiers')[$tier]['label'] ?? (self::LABELS[$tier] ?? $tier);
    }

    /** A plan's tier ('plans' or 'trainer_plans'), null when it has none (or before the SQL). */
    public static function planTier(PDO $pdo, string $table, string $planId): ?string
    {
        if (!self::ready() || !in_array($table, ['plans', 'trainer_plans'], true)) {
            return null;
        }
        $stmt = $pdo->prepare("SELECT tier FROM {$table} WHERE id = :id");
        $stmt->execute(['id' => $planId]);
        $tier = $stmt->fetchColumn();
        return self::valid($tier) ? $tier : null;
    }

    /** Gives the club's latest subscription this tier (after a purchase or renewal with a plan). */
    public static function setClubTier(PDO $pdo, string $clubId, ?string $tier): void
    {
        if (!self::ready()) {
            return;
        }
        $pdo->prepare(
            'UPDATE subscriptions SET tier = :tier WHERE club_id = :club_id ORDER BY expires_at DESC LIMIT 1'
        )->execute(['tier' => self::valid($tier) ? $tier : null, 'club_id' => $clubId]);
    }

    public static function setTrainerTier(PDO $pdo, string $trainerId, ?string $tier): void
    {
        if (!self::ready()) {
            return;
        }
        $pdo->prepare('UPDATE trainer_subscriptions SET tier = :tier WHERE trainer_id = :id')
            ->execute(['tier' => self::valid($tier) ? $tier : null, 'id' => $trainerId]);
    }

    /**
     * The tier that decides what this user may open; null = not limited.
     */
    public static function effective(PDO $pdo, array $user): ?string
    {
        $id = (string) $user['id'];
        if (array_key_exists($id, self::$cache)) {
            return self::$cache[$id];
        }
        if (!self::ready() || AdminAccess::of($user) !== null) {
            return self::$cache[$id] = null;
        }
        try {
            return self::$cache[$id] = match ($user['account_type'] ?? null) {
                'trainer' => self::trainerTier($pdo, $id),
                'club'    => self::ownerTier($pdo, $id),
                'athlete' => self::athleteTier($pdo, $id),
                default   => null,
            };
        } catch (Throwable $e) {
            error_log('Tiers::effective: ' . $e->getMessage());
            return self::$cache[$id] = null;
        }
    }

    /**
     * Whether some tier, or some account's own access, has this section
     * switched off (else nobody needs looking up).
     */
    public static function restricts(string $feature): bool
    {
        $config = Settings::get('tiers');
        foreach (self::KEYS as $tier) {
            if (($config[$tier]['features'][$feature] ?? true) === false) {
                return true;
            }
        }
        return AccountAccess::closesAnywhere(Database::connection(), $feature);
    }

    /**
     * Whether this user may open the section: the first account in their
     * chain (subjects) that has it switched on or off by hand decides;
     * otherwise their tier. Admins always may.
     */
    public static function allowsUser(PDO $pdo, array $user, string $feature): bool
    {
        foreach (self::subjects($pdo, $user) as [$kind, $id]) {
            $set = AccountAccess::feature($pdo, $kind, $id, $feature);
            if ($set !== null) {
                return $set;
            }
        }
        return self::allows(self::effective($pdo, $user), $feature);
    }

    /**
     * Every section the user's accounts have set by hand, resolved as
     * allowsUser does: for the panel to show and hide the same things.
     *
     * @return array<string, bool>
     */
    public static function accessFor(PDO $pdo, array $user): array
    {
        $out = [];
        foreach (array_reverse(self::subjects($pdo, $user)) as [$kind, $id]) {
            $out = array_merge($out, AccountAccess::get($pdo, $kind, $id)['features'] ?? []);
        }
        return $out;
    }

    /**
     * The accounts whose access applies to this user, nearest first:
     * a trainer and their club; an athlete's trainer and that trainer's
     * club, or the athlete's club; a club owner's club. None for admins.
     *
     * @return list<array{0: string, 1: string}>
     */
    public static function subjects(PDO $pdo, array $user): array
    {
        if (AdminAccess::of($user) !== null) {
            return [];
        }
        $id = (string) $user['id'];
        try {
            switch ($user['account_type'] ?? null) {
                case 'trainer':
                    return self::trainerChain($pdo, $id);
                case 'club':
                    $club = self::ownedClub($pdo, $id);
                    return $club !== null ? [['club', $club]] : [];
                case 'athlete':
                    $trainerId = self::athleteTrainer($pdo, $id);
                    if ($trainerId !== null) {
                        return self::trainerChain($pdo, $trainerId);
                    }
                    $club = self::memberClub($pdo, $id, null);
                    return $club !== null ? [['club', $club]] : [];
            }
        } catch (Throwable $e) {
            error_log('Tiers::subjects: ' . $e->getMessage());
        }
        return [];
    }

    /** @return list<array{0: string, 1: string}> */
    private static function trainerChain(PDO $pdo, string $trainerId): array
    {
        $chain = [['trainer', $trainerId]];
        $club = self::memberClub($pdo, $trainerId, 'trainer');
        if ($club !== null) {
            $chain[] = ['club', $club];
        }
        return $chain;
    }

    /** null (not limited) opens everything. */
    public static function allows(?string $tier, string $feature): bool
    {
        if ($tier === null) {
            return true;
        }
        return (Settings::get('tiers')[$tier]['features'][$feature] ?? true) !== false;
    }

    /** The free tier's cap for a trainer's athletes ('max_athletes') or a club's members ('max_members'). */
    public static function freeCap(string $kind): ?int
    {
        return Settings::get('tiers')['free_limits'][$kind] ?? null;
    }

    /**
     * The tier the account's plan gives (its club's, for a trainer without
     * one of their own), leaving out a tier the admin fixed for the account
     * itself: what "as the plan says" means on the admin's access screen.
     */
    public static function fromPlan(PDO $pdo, string $kind, string $id): ?string
    {
        if (!self::ready()) {
            return null;
        }
        return $kind === 'trainer' ? self::trainerTier($pdo, $id, false) : self::clubTier($pdo, $id, false);
    }

    private static function trainerTier(PDO $pdo, string $trainerId, bool $useFixed = true): ?string
    {
        $fixed = $useFixed ? (AccountAccess::get($pdo, 'trainer', $trainerId)['tier'] ?? null) : null;
        if ($fixed !== null) {
            return $fixed;
        }
        if (Database::hasTable('trainer_subscriptions')) {
            $stmt = $pdo->prepare('SELECT tier, expires_at FROM trainer_subscriptions WHERE trainer_id = :id');
            $stmt->execute(['id' => $trainerId]);
            $row = $stmt->fetch();
            if ($row !== false && self::running($row['expires_at'])) {
                return self::valid($row['tier']) ? $row['tier'] : null;
            }
        }
        $clubId = self::memberClub($pdo, $trainerId, 'trainer');
        return $clubId !== null ? self::clubTier($pdo, $clubId) : 'free';
    }

    private static function ownerTier(PDO $pdo, string $ownerId): ?string
    {
        $clubId = self::ownedClub($pdo, $ownerId);
        return $clubId !== null ? self::clubTier($pdo, $clubId) : 'free';
    }

    private static function athleteTier(PDO $pdo, string $athleteId): ?string
    {
        $trainerId = self::athleteTrainer($pdo, $athleteId);
        if ($trainerId !== null) {
            return self::trainerTier($pdo, $trainerId);
        }
        $clubId = self::memberClub($pdo, $athleteId, null);
        return $clubId !== null ? self::clubTier($pdo, $clubId) : 'free';
    }

    /** The club the user is an active member of ($role: as a trainer; null: any role), first joined. */
    private static function memberClub(PDO $pdo, string $userId, ?string $role): ?string
    {
        $stmt = $pdo->prepare(
            "SELECT club_id FROM memberships WHERE user_id = :id AND status = 'active'"
            . ($role !== null ? ' AND role = :role' : '') . ' ORDER BY joined_at LIMIT 1'
        );
        $stmt->execute(['id' => $userId] + ($role !== null ? ['role' => $role] : []));
        $clubId = $stmt->fetchColumn();
        return $clubId !== false ? (string) $clubId : null;
    }

    private static function ownedClub(PDO $pdo, string $ownerId): ?string
    {
        $stmt = $pdo->prepare('SELECT id FROM clubs WHERE owner_id = :id ORDER BY created_at LIMIT 1');
        $stmt->execute(['id' => $ownerId]);
        $clubId = $stmt->fetchColumn();
        return $clubId !== false ? (string) $clubId : null;
    }

    private static function athleteTrainer(PDO $pdo, string $athleteId): ?string
    {
        $stmt = $pdo->prepare(
            "SELECT trainer_id FROM trainer_athletes WHERE athlete_id = :id AND status = 'active' ORDER BY created_at LIMIT 1"
        );
        $stmt->execute(['id' => $athleteId]);
        $trainerId = $stmt->fetchColumn();
        return $trainerId !== false ? (string) $trainerId : null;
    }

    /**
     * The club's tier: the one the admin fixed for it (AccountAccess), else
     * its running subscription's; free with none running.
     */
    public static function clubTier(PDO $pdo, string $clubId, bool $useFixed = true): ?string
    {
        $fixed = $useFixed ? (AccountAccess::get($pdo, 'club', $clubId)['tier'] ?? null) : null;
        if ($fixed !== null) {
            return $fixed;
        }
        $stmt = $pdo->prepare('SELECT tier, expires_at FROM subscriptions WHERE club_id = :id ORDER BY expires_at DESC LIMIT 1');
        $stmt->execute(['id' => $clubId]);
        $row = $stmt->fetch();
        if ($row === false || !self::running($row['expires_at'])) {
            return 'free';
        }
        return self::valid($row['tier']) ? $row['tier'] : null;
    }

    /** Whether the club has a subscription running right now (its plan's caps apply, not the free tier's). */
    public static function clubHasRunning(PDO $pdo, string $clubId): bool
    {
        $stmt = $pdo->prepare('SELECT MAX(expires_at) FROM subscriptions WHERE club_id = :id');
        $stmt->execute(['id' => $clubId]);
        $expires = $stmt->fetchColumn();
        return $expires !== false && $expires !== null && self::running((string) $expires);
    }

    /**
     * Whether a paid subscription still counts: until its end, and through
     * the grace days after it (Subscriptions::status), when everything works
     * as before. A row with no end is the free trainer plan, not a paid one.
     */
    private static function running(?string $expiresAt): bool
    {
        return in_array(Subscriptions::status($expiresAt), ['active', 'expiring', 'grace'], true);
    }
}
