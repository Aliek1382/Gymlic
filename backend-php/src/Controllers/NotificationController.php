<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Auth;
use Gymlic\Cast;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Uuid;
use Gymlic\Validate;

final class NotificationController
{
    private const COLUMNS = 'id, actor_id, type, title, body, link, metadata, read_at, created_at';
    private const PAGE_SIZE = 20;
    private const ARCHIVE_PAGE_SIZE = 30;

    public static function list(): void
    {
        $user = Auth::requireUser();

        $stmt = Database::connection()->prepare(
            'SELECT ' . self::COLUMNS . ' FROM notifications
             WHERE recipient_id = :id ORDER BY created_at DESC LIMIT ' . self::PAGE_SIZE
        );
        $stmt->execute(['id' => $user['id']]);

        Response::ok(['items' => self::decode($stmt->fetchAll())]);
    }

    /**
     * Keyset pagination on created_at, as the client did: offsets shift under a
     * live-updating list and would duplicate or skip rows between pages.
     */
    public static function archive(): void
    {
        $user = Auth::requireUser();
        $cursor = $_GET['cursor'] ?? null;

        $sql = 'SELECT ' . self::COLUMNS . ' FROM notifications WHERE recipient_id = :id';
        $bind = ['id' => $user['id']];

        if ($cursor !== null && $cursor !== '') {
            $sql .= ' AND created_at < :cursor';
            $bind['cursor'] = $cursor;
        }
        $sql .= ' ORDER BY created_at DESC LIMIT ' . self::ARCHIVE_PAGE_SIZE;

        $stmt = Database::connection()->prepare($sql);
        $stmt->execute($bind);
        $rows = $stmt->fetchAll();

        Response::ok([
            'items'       => self::decode($rows),
            'next_cursor' => count($rows) === self::ARCHIVE_PAGE_SIZE ? end($rows)['created_at'] : null,
        ]);
    }

    public static function markRead(array $params): void
    {
        $user = Auth::requireUser();

        Database::connection()
            ->prepare('UPDATE notifications SET read_at = NOW() WHERE id = :id AND recipient_id = :user AND read_at IS NULL')
            ->execute(['id' => $params['id'], 'user' => $user['id']]);

        Response::ok(['ok' => true]);
    }

    public static function markAllRead(): void
    {
        $user = Auth::requireUser();

        Database::connection()
            ->prepare('UPDATE notifications SET read_at = NOW() WHERE recipient_id = :user AND read_at IS NULL')
            ->execute(['user' => $user['id']]);

        Response::ok(['ok' => true]);
    }

    /** create_broadcast_notification (0021/0024): every profile, or every active member of the given clubs. */
    public static function broadcast(): void
    {
        $admin = Auth::requirePlatformAdmin();
        $data = Validate::required(Validate::body(), ['title']);
        $clubIds = $data['club_ids'] ?? null;

        $pdo = Database::connection();

        if (is_array($clubIds) && $clubIds !== []) {
            $placeholders = implode(',', array_fill(0, count($clubIds), '?'));
            $stmt = $pdo->prepare(
                "SELECT DISTINCT user_id FROM memberships WHERE status = 'active' AND club_id IN ({$placeholders})"
            );
            $stmt->execute($clubIds);
            $recipients = array_column($stmt->fetchAll(), 'user_id');
        } else {
            $recipients = array_column($pdo->query('SELECT id FROM profiles')->fetchAll(), 'id');
        }

        $insert = $pdo->prepare(
            'INSERT INTO notifications (id, recipient_id, actor_id, type, title, body, link, metadata)
             VALUES (:id, :recipient_id, :actor_id, :type, :title, :body, :link, :metadata)'
        );

        $pdo->beginTransaction();
        foreach ($recipients as $recipientId) {
            $insert->execute([
                'id'           => Uuid::v4(),
                'recipient_id' => $recipientId,
                'actor_id'     => $admin['id'],
                'type'         => 'broadcast',
                'title'        => (string) $data['title'],
                'body'         => Validate::nullableString($data['body'] ?? null),
                'link'         => Validate::nullableString($data['link'] ?? null),
                'metadata'     => '{}',
            ]);
        }
        $pdo->commit();

        Response::ok(['sent' => count($recipients)]);
    }

    /** metadata is a JSON column; hand the client an object, not a string. */
    private static function decode(array $rows): array
    {
        return Cast::json($rows);
    }
}
