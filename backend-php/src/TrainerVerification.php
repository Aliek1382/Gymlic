<?php
declare(strict_types=1);

namespace Gymlic;

use PDO;

/**
 * The "verified trainer" badge: a trainer sends the certificates in their
 * résumé for review, an admin with users.manage looks at them and verifies
 * or rejects (with a reason), and can take the badge back later. Stored on
 * trainer_profiles (operations-update.sql); before that SQL nobody is
 * verified and nothing here does anything.
 */
final class TrainerVerification
{
    public const STATUSES = ['none', 'pending', 'verified', 'rejected'];

    private function __construct()
    {
    }

    public static function ready(): bool
    {
        return Database::hasColumn('trainer_profiles', 'verified_by');
    }

    /** @return array{status: string, note: ?string, requested_at: ?string, verified_at: ?string}|null */
    public static function of(PDO $pdo, string $trainerId): ?array
    {
        if (!self::ready()) {
            return null;
        }
        $stmt = $pdo->prepare(
            'SELECT verification_status AS status, verification_note AS note,
                    verification_requested_at AS requested_at, verified_at
             FROM trainer_profiles WHERE trainer_id = :id'
        );
        $stmt->execute(['id' => $trainerId]);
        $row = $stmt->fetch();
        return $row === false ? ['status' => 'none', 'note' => null, 'requested_at' => null, 'verified_at' => null] : $row;
    }

    public static function isVerified(PDO $pdo, string $trainerId): bool
    {
        return (self::of($pdo, $trainerId)['status'] ?? 'none') === 'verified';
    }

    /** SQL for "is this trainer verified" next to a trainer id column (0 before the SQL). */
    public static function flagSql(string $trainerIdColumn): string
    {
        return self::ready()
            ? "EXISTS (SELECT 1 FROM trainer_profiles tpv WHERE tpv.trainer_id = {$trainerIdColumn} AND tpv.verification_status = 'verified')"
            : '0';
    }
}
