<?php
declare(strict_types=1);

namespace Gymlic;

use PDO;
use Throwable;

/**
 * An admin's announcement to a chosen group: who receives it (account
 * types, members of some clubs, people who haven't been seen for N days),
 * whether it also goes out by SMS / email, and when.
 *
 * Every recipient gets an in-panel notification (pushed to their devices by
 * the cron's push sweep). SMS and email copies are rows in
 * notification_deliveries, sent by cron/notification-dispatch.php like any
 * other notification's — a broadcast never waits on a provider. A scheduled
 * one is sent by that same cron once its time comes.
 */
final class Broadcasts
{
    public const ROLES = ['club', 'trainer', 'athlete'];
    public const CHANNEL_MODES = ['off', 'opted', 'all'];

    private const CHUNK = 500;

    private function __construct()
    {
    }

    /** False until communication-update.sql has run: no history, no scheduling. */
    public static function ready(): bool
    {
        return Database::hasColumn('broadcasts', 'audience');
    }

    /** @return array{roles: list<string>, club_ids: list<string>, inactive_days: int} */
    public static function normalizeAudience(mixed $value): array
    {
        $v = is_array($value) ? $value : [];
        $roles = array_values(array_intersect(self::ROLES, is_array($v['roles'] ?? null) ? $v['roles'] : []));
        $clubIds = array_values(array_unique(array_filter(
            is_array($v['club_ids'] ?? null) ? $v['club_ids'] : [],
            static fn ($id): bool => is_string($id) && preg_match('/^[0-9a-f-]{36}$/i', $id) === 1
        )));
        $days = is_numeric($v['inactive_days'] ?? null) ? max(0, min(3650, (int) $v['inactive_days'])) : 0;

        return ['roles' => $roles, 'club_ids' => $clubIds, 'inactive_days' => $days];
    }

    /** @return array{sms: string, email: string} */
    public static function normalizeChannels(mixed $value): array
    {
        $v = is_array($value) ? $value : [];
        return [
            'sms'   => in_array($v['sms'] ?? null, self::CHANNEL_MODES, true) ? $v['sms'] : 'off',
            'email' => in_array($v['email'] ?? null, self::CHANNEL_MODES, true) ? $v['email'] : 'off',
        ];
    }

    /**
     * Everyone the audience covers (suspended accounts never), with what
     * their SMS / email copy needs.
     *
     * @return list<array{id: string, phone: ?string, email: ?string, notify_sms: int|string, notify_email: int|string}>
     */
    public static function recipients(PDO $pdo, array $audience): array
    {
        $where = ['p.is_suspended = 0'];
        $bind = [];

        if ($audience['roles'] !== []) {
            $where[] = 'p.account_type IN (' . implode(',', array_fill(0, count($audience['roles']), '?')) . ')';
            array_push($bind, ...$audience['roles']);
        }
        if ($audience['club_ids'] !== []) {
            $where[] = "p.id IN (SELECT m.user_id FROM memberships m WHERE m.status = 'active' AND m.club_id IN ("
                . implode(',', array_fill(0, count($audience['club_ids']), '?')) . '))';
            array_push($bind, ...$audience['club_ids']);
        }
        if ($audience['inactive_days'] > 0) {
            // last_seen_at once phase 7's SQL has run; before that, the last
            // sign-in is the best there is.
            $seen = Database::hasColumn('profiles', 'last_seen_at')
                ? 'COALESCE(p.last_seen_at, (SELECT MAX(s.created_at) FROM sessions s WHERE s.user_id = p.id), p.created_at)'
                : 'COALESCE((SELECT MAX(s.created_at) FROM sessions s WHERE s.user_id = p.id), p.created_at)';
            $where[] = "{$seen} < ?";
            $bind[] = date('Y-m-d H:i:s', time() - $audience['inactive_days'] * 86400);
        }

        $stmt = $pdo->prepare(
            'SELECT p.id, p.phone, p.email, p.notify_sms, p.notify_email FROM profiles p WHERE ' . implode(' AND ', $where)
        );
        $stmt->execute($bind);
        return $stmt->fetchAll();
    }

    /** How many would receive it, and how many of those by SMS / email. */
    public static function preview(PDO $pdo, array $audience, array $channels): array
    {
        $people = self::recipients($pdo, $audience);
        $sms = 0;
        $email = 0;
        foreach ($people as $p) {
            $sms += self::wants($p, 'sms', $channels['sms']) ? 1 : 0;
            $email += self::wants($p, 'email', $channels['email']) ? 1 : 0;
        }
        return ['recipients' => count($people), 'sms' => $sms, 'email' => $email];
    }

    /**
     * Writes the notifications (and SMS / email deliveries) for one
     * broadcast. Returns the counts.
     *
     * @param array{id: ?string, title: string, body: ?string, link: ?string, audience: array, channels: array, created_by: ?string} $b
     * @return array{recipients: int, sms: int, email: int}
     */
    public static function deliver(PDO $pdo, array $b): array
    {
        $people = self::recipients($pdo, $b['audience']);
        $deliveries = Database::hasColumn('notification_deliveries', 'channel');

        $notification = $pdo->prepare(
            'INSERT INTO notifications (id, recipient_id, actor_id, type, title, body, link, metadata)
             VALUES (:id, :recipient_id, :actor_id, :type, :title, :body, :link, :metadata)'
        );
        $delivery = $deliveries
            ? $pdo->prepare('INSERT INTO notification_deliveries (id, notification_id, channel) VALUES (:id, :notification_id, :channel)')
            : null;
        $metadata = json_encode($b['id'] !== null ? ['broadcast_id' => $b['id']] : new \stdClass());

        $counts = ['recipients' => 0, 'sms' => 0, 'email' => 0];
        foreach (array_chunk($people, self::CHUNK) as $chunk) {
            $pdo->beginTransaction();
            try {
                foreach ($chunk as $p) {
                    $id = Uuid::v4();
                    $notification->execute([
                        'id'           => $id,
                        'recipient_id' => $p['id'],
                        'actor_id'     => $b['created_by'],
                        'type'         => 'broadcast',
                        'title'        => $b['title'],
                        'body'         => $b['body'],
                        'link'         => $b['link'],
                        'metadata'     => $metadata,
                    ]);
                    $counts['recipients']++;

                    foreach (['sms', 'email'] as $channel) {
                        if ($delivery !== null && self::wants($p, $channel, $b['channels'][$channel])) {
                            $delivery->execute(['id' => Uuid::v4(), 'notification_id' => $id, 'channel' => $channel]);
                            $counts[$channel]++;
                        }
                    }
                }
                $pdo->commit();
            } catch (Throwable $e) {
                $pdo->rollBack();
                throw $e;
            }
        }

        return $counts;
    }

    /**
     * Sends the scheduled broadcasts whose time has come; for the dispatch
     * cron. Each is claimed first (scheduled -> sending), so two overlapping
     * runs never send one twice.
     */
    public static function sendDue(PDO $pdo): int
    {
        if (!self::ready()) {
            return 0;
        }
        // scheduled_at is written in PHP's clock (BroadcastController), so it
        // is compared against PHP's, not the database's NOW().
        $stmt = $pdo->prepare(
            "SELECT * FROM broadcasts WHERE status = 'scheduled' AND scheduled_at <= :now ORDER BY scheduled_at LIMIT 5"
        );
        $stmt->execute(['now' => date('Y-m-d H:i:s')]);
        $due = $stmt->fetchAll();

        $sent = 0;
        foreach ($due as $row) {
            $claim = $pdo->prepare("UPDATE broadcasts SET status = 'sending' WHERE id = :id AND status = 'scheduled'");
            $claim->execute(['id' => $row['id']]);
            if ($claim->rowCount() === 0) {
                continue;
            }
            try {
                self::sendRow($pdo, $row);
                $sent++;
            } catch (Throwable $e) {
                // Recorded on the row as 'failed'; the rest still go out.
            }
        }
        return $sent;
    }

    /** Sends one stored broadcast row and records the outcome on it. */
    public static function sendRow(PDO $pdo, array $row): array
    {
        try {
            $counts = self::deliver($pdo, [
                'id'         => $row['id'],
                'title'      => $row['title'],
                'body'       => $row['body'],
                'link'       => $row['link'],
                'audience'   => self::normalizeAudience(json_decode((string) $row['audience'], true)),
                'channels'   => self::normalizeChannels(json_decode((string) $row['channels'], true)),
                'created_by' => $row['created_by'],
            ]);
            $pdo->prepare(
                "UPDATE broadcasts SET status = 'sent', sent_at = NOW(), recipient_count = :r, sms_count = :s, email_count = :e
                 WHERE id = :id"
            )->execute(['r' => $counts['recipients'], 's' => $counts['sms'], 'e' => $counts['email'], 'id' => $row['id']]);
            return $counts;
        } catch (Throwable $e) {
            error_log('broadcast ' . $row['id'] . ': ' . $e->getMessage());
            $pdo->prepare("UPDATE broadcasts SET status = 'failed', error = :error WHERE id = :id")
                ->execute(['error' => mb_substr($e->getMessage(), 0, 500), 'id' => $row['id']]);
            throw $e;
        }
    }

    /** off: never; opted: only if they switched that channel on; all: anyone with a phone / email. */
    private static function wants(array $person, string $channel, string $mode): bool
    {
        $address = trim((string) ($channel === 'sms' ? $person['phone'] : $person['email']));
        if ($mode === 'off' || $address === '') {
            return false;
        }
        return $mode === 'all' || (int) ($channel === 'sms' ? $person['notify_sms'] : $person['notify_email']) === 1;
    }
}
