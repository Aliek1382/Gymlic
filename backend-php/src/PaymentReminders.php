<?php

declare(strict_types=1);

namespace Gymlic;

use PDO;

/**
 * Tells whoever has to answer a payment that it has been waiting: the
 * platform's finance admins for club and trainer subscriptions, the club
 * owner for a member's payment, the trainer for an athlete's. One message per
 * reviewer, not per request, and again only after another full interval has
 * passed (the pending_remind_days setting; 0 turns it off).
 */
final class PaymentReminders
{
    private const JOB = 'payment-review-reminders';

    /** table => [reviewer SQL (selects reviewer_id, id, created_at of pending rows), link] */
    private static function sources(): array
    {
        return [
            'payment_requests' => [
                'reviewers' => 'admin',
                'link'      => '/admin/payments',
            ],
            'trainer_payment_requests' => [
                'reviewers' => 'admin',
                'link'      => '/admin/trainer-billing',
            ],
            'membership_payment_requests' => [
                'reviewers' => 'SELECT c.owner_id FROM clubs c WHERE c.id = r.club_id',
                'link'      => '/member-payments',
            ],
            'invoice_payment_claims' => [
                'reviewers' => 'SELECT i.trainer_id FROM invoices i WHERE i.id = r.invoice_id',
                'link'      => '/invoices',
            ],
        ];
    }

    /** @return array{reviewers: int, requests: int} */
    public static function send(PDO $pdo): array
    {
        $out = ['reviewers' => 0, 'requests' => 0];
        $days = (int) Settings::get('billing')['pending_remind_days'];
        if ($days <= 0) {
            return $out;
        }

        $cutoff = date('Y-m-d H:i:s', time() - $days * 86400);
        // reviewer id => [count, oldest created_at, link, [[table, id], ...]]
        $waiting = [];
        $admins = null;

        foreach (self::sources() as $table => $source) {
            if (!Database::hasTable($table) || !Database::hasColumn($table, 'reminded_at')) {
                continue;
            }
            $sql = "SELECT r.id, r.created_at"
                . ($source['reviewers'] === 'admin' ? '' : ', (' . $source['reviewers'] . ') AS reviewer_id')
                . " FROM {$table} r
                   WHERE r.status = 'pending' AND r.created_at <= :cutoff
                     AND (r.reminded_at IS NULL OR r.reminded_at <= :cutoff2)";
            $stmt = $pdo->prepare($sql);
            $stmt->execute(['cutoff' => $cutoff, 'cutoff2' => $cutoff]);

            foreach ($stmt->fetchAll() as $row) {
                if ($source['reviewers'] === 'admin') {
                    $admins ??= AdminAccess::holders($pdo, 'finance.payments');
                    $reviewers = $admins;
                } else {
                    $reviewers = $row['reviewer_id'] === null ? [] : [$row['reviewer_id']];
                }
                foreach ($reviewers as $reviewer) {
                    $key = $reviewer . '|' . $source['link'];
                    $waiting[$key] ??= ['reviewer' => $reviewer, 'link' => $source['link'], 'count' => 0, 'oldest' => $row['created_at'], 'rows' => []];
                    $waiting[$key]['count']++;
                    if ($row['created_at'] < $waiting[$key]['oldest']) {
                        $waiting[$key]['oldest'] = $row['created_at'];
                    }
                    $waiting[$key]['rows'][$table . '|' . $row['id']] = [$table, $row['id']];
                }
                $out['requests']++;
            }
        }

        // Mark first, then tell: a second run must not repeat the notice.
        $marked = [];
        foreach ($waiting as $group) {
            foreach ($group['rows'] as [$table, $id]) {
                if (!isset($marked[$table . '|' . $id])) {
                    $pdo->prepare("UPDATE {$table} SET reminded_at = NOW() WHERE id = :id AND status = 'pending'")->execute(['id' => $id]);
                    $marked[$table . '|' . $id] = true;
                }
            }
        }
        foreach ($waiting as $group) {
            Templates::notify(
                $pdo,
                'payment_review_waiting',
                $group['reviewer'],
                null,
                'broadcast',
                [
                    'count' => (string) $group['count'],
                    'days'  => (string) max(1, (int) floor((time() - (int) strtotime($group['oldest'])) / 86400)),
                ],
                $group['link']
            );
            $out['reviewers']++;
        }

        return $out;
    }

    /** @param array{reviewers: int, requests: int} $sent */
    public static function summary(array $sent): string
    {
        return "payment reminders: {$sent['requests']} waiting requests, {$sent['reviewers']} reviewers told";
    }

    /** send() at most every six hours, for hosts without the cron job. Never throws. */
    public static function sendIfDue(PDO $pdo): void
    {
        try {
            $stmt = $pdo->prepare('SELECT value FROM app_settings WHERE setting_key = :key');
            $stmt->execute(['key' => 'cron.' . self::JOB]);
            $last = json_decode((string) $stmt->fetchColumn(), true);
            if (is_array($last) && isset($last['at']) && strtotime((string) $last['at']) > time() - 6 * 3600) {
                return;
            }
            CronHeartbeat::record(self::JOB, self::summary(self::send($pdo)));
        } catch (\Throwable $e) {
            error_log('payment reminders: ' . $e->getMessage());
        }
    }
}
