<?php
declare(strict_types=1);

namespace Gymlic;

use PDO;

/**
 * Sends the SMS / email copies of notifications (notification_deliveries).
 * Shared by cron/notification-dispatch.php and the admin's "send now" in
 * /admin/deliveries, so both send exactly the same message the same way.
 */
final class DeliveryDispatcher
{
    /** After this many tries a row is left as 'failed' until someone retries it. */
    public const MAX_ATTEMPTS = 3;

    private function __construct()
    {
    }

    /**
     * The rows the cron should try now.
     *
     * @return list<array<string, mixed>>
     */
    public static function due(PDO $pdo, int $limit): array
    {
        return $pdo->query(
            self::selectSql() . "
             WHERE d.status IN ('pending', 'failed') AND d.attempts < " . self::MAX_ATTEMPTS . '
             ORDER BY d.created_at
             LIMIT ' . $limit
        )->fetchAll();
    }

    /** @return array<string, mixed>|null */
    public static function find(PDO $pdo, string $id): ?array
    {
        $stmt = $pdo->prepare(self::selectSql() . ' WHERE d.id = :id');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    /**
     * Claims and sends one row. Returns null when another run already took it,
     * otherwise [sent, error].
     *
     * @return array{0: bool, 1: string}|null
     */
    public static function send(PDO $pdo, array $row): ?array
    {
        // Claim first, so two overlapping runs never send the same row twice.
        $claim = $pdo->prepare(
            "UPDATE notification_deliveries SET attempts = attempts + 1
             WHERE id = :id AND attempts = :attempts AND status IN ('pending', 'failed')"
        );
        $claim->execute(['id' => $row['id'], 'attempts' => $row['attempts']]);
        if ($claim->rowCount() === 0) {
            return null;
        }

        $title = (string) $row['title'];
        $body = trim((string) ($row['body'] ?? ''));

        if ($row['channel'] === 'sms') {
            $ok = SmsGateway::send((string) $row['phone'], $body === '' ? $title : $title . "\n" . $body);
            $error = SmsGateway::lastError();
        } else {
            $ok = MailGateway::send((string) $row['email'], $title, $body === '' ? $title : $body);
            $error = MailGateway::lastError();
        }

        if ($ok) {
            $pdo->prepare("UPDATE notification_deliveries SET status = 'sent', sent_at = NOW(), last_error = NULL WHERE id = :id")
                ->execute(['id' => $row['id']]);
            return [true, ''];
        }

        $error = mb_substr($error !== '' ? $error : 'unknown error', 0, 500);
        $pdo->prepare("UPDATE notification_deliveries SET status = 'failed', last_error = :error WHERE id = :id")
            ->execute(['id' => $row['id'], 'error' => $error]);
        return [false, $error];
    }

    private static function selectSql(): string
    {
        return 'SELECT d.id, d.channel, d.attempts, n.title, n.body, p.phone, p.email
                FROM notification_deliveries d
                JOIN notifications n ON n.id = d.notification_id
                JOIN profiles p ON p.id = n.recipient_id';
    }
}
