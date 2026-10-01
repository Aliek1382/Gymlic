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

    /** Whether some tier has this section switched off (else nobody needs looking up). */
    public static function restricts(string $feature): bool
    {
        $config = Settings::get('tiers');
        foreach (self::KEYS as $tier) {
            if (($config[$tier]['features'][$feature] ?? true) === false) {
                return true;
            }
        }
        return false;
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

    private static function trainerTier(PDO $pdo, string $trainerId): ?string
    {
        if (Database::hasTable('trainer_subscriptions')) {
            $stmt = $pdo->prepare('SELECT tier, expires_at FROM trainer_subscriptions WHERE trainer_id = :id');
            $stmt->execute(['id' => $trainerId]);
            $row = $stmt->fetch();
            if ($row !== false && strtotime((string) $row['expires_at']) > time()) {
                return self::valid($row['tier']) ? $row['tier'] : null;
            }
        }
        $club = $pdo->prepare(
            "SELECT club_id FROM memberships WHERE user_id = :id AND role = 'trainer' AND status = 'active' ORDER BY joined_at LIMIT 1"
        );
        $club->execute(['id' => $trainerId]);
        $clubId = $club->fetchColumn();
        return $clubId !== false ? self::clubTier($pdo, (string) $clubId) : 'free';
    }

    private static function ownerTier(PDO $pdo, string $ownerId): ?string
    {
        $stmt = $pdo->prepare('SELECT id FROM clubs WHERE owner_id = :id ORDER BY created_at LIMIT 1');
        $stmt->execute(['id' => $ownerId]);
        $clubId = $stmt->fetchColumn();
        return $clubId !== false ? self::clubTier($pdo, (string) $clubId) : 'free';
    }

    private static function athleteTier(PDO $pdo, string $athleteId): ?string
    {
        $stmt = $pdo->prepare(
            "SELECT trainer_id FROM trainer_athletes WHERE athlete_id = :id AND status = 'active' ORDER BY created_at LIMIT 1"
        );
        $stmt->execute(['id' => $athleteId]);
        $trainerId = $stmt->fetchColumn();
        if ($trainerId !== false) {
            return self::trainerTier($pdo, (string) $trainerId);
        }
        $club = $pdo->prepare(
            "SELECT club_id FROM memberships WHERE user_id = :id AND status = 'active' ORDER BY joined_at LIMIT 1"
        );
        $club->execute(['id' => $athleteId]);
        $clubId = $club->fetchColumn();
        return $clubId !== false ? self::clubTier($pdo, (string) $clubId) : 'free';
    }

    /** The club's running subscription's tier; free with none running. */
    public static function clubTier(PDO $pdo, string $clubId): ?string
    {
        $stmt = $pdo->prepare('SELECT tier, expires_at FROM subscriptions WHERE club_id = :id ORDER BY expires_at DESC LIMIT 1');
        $stmt->execute(['id' => $clubId]);
        $row = $stmt->fetch();
        if ($row === false || strtotime((string) $row['expires_at']) <= time()) {
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
        return $expires !== false && $expires !== null && strtotime((string) $expires) > time();
    }
}
