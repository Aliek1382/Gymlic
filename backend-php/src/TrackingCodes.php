<?php
declare(strict_types=1);

namespace Gymlic;

/**
 * Whether a bank tracking code has been used by another payment anywhere on
 * the site. Every card-to-card payment a person files (a club's or a trainer's
 * subscription, an athlete's invoice or membership fee) carries one, and the
 * same transfer receipt being offered twice, to two different people, is the
 * easiest way to cheat the system.
 *
 * It is a warning for the reviewer, never a block: banks do hand out short
 * codes that can coincide. Only payments that are waiting or approved count;
 * a rejected one was not a real payment, so filing it again with the same
 * code (after a typo, say) is not flagged.
 */
final class TrackingCodes
{
    /** Every table that holds payments with a tracking_code, once its column exists. */
    private const TABLES = [
        'payment_requests',
        'trainer_payment_requests',
        'invoice_payment_claims',
        'membership_payment_requests',
    ];

    private function __construct()
    {
    }

    /**
     * A SQL boolean: another waiting or approved payment, in any table, has the
     * same tracking code as the row $alias of $selfTable. $alias.id is the row's
     * own id (excluded from the match).
     */
    public static function duplicateExpr(string $selfTable, string $alias): string
    {
        $parts = [];
        foreach (self::TABLES as $table) {
            if (!Database::hasColumn($table, 'tracking_code')) {
                continue;
            }
            $notSelf = $table === $selfTable ? " AND o.id <> {$alias}.id" : '';
            $parts[] = "SELECT 1 FROM {$table} o
                        WHERE o.tracking_code = {$alias}.tracking_code
                          AND o.status IN ('pending', 'approved'){$notSelf}";
        }
        if ($parts === []) {
            return '0';
        }

        return "({$alias}.tracking_code IS NOT NULL AND {$alias}.tracking_code <> 'DISCOUNT' AND EXISTS ("
            . implode(' UNION ALL ', $parts) . '))';
    }
}
