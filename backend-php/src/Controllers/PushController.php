<?php
declare(strict_types=1);

namespace Gymlic\Controllers;

use Gymlic\Auth;
use Gymlic\Database;
use Gymlic\Response;
use Gymlic\Uuid;
use Gymlic\Validate;
use Gymlic\WebPush;

/**
 * Browser push subscriptions: one row per browser/device a user turned
 * notifications on for. Sending is done by sendToUser(), used by cron.
 */
final class PushController
{
    /** VAPID wants a mailto: or https: contact; the site's own origin is one. */
    private const DEFAULT_SUBJECT = 'https://gymlic-panel.ir';

    public static function publicKey(): void
    {
        Auth::requireUser();
        Response::ok(['public_key' => WebPush::vapidKeys(Database::connection())['public_key']]);
    }

    public static function subscribe(): void
    {
        $user = Auth::requireUser();
        $data = Validate::required(Validate::body(), ['endpoint', 'keys']);
        $keys = is_array($data['keys']) ? $data['keys'] : [];

        $endpoint = (string) $data['endpoint'];
        $p256dh = (string) ($keys['p256dh'] ?? '');
        $auth = (string) ($keys['auth'] ?? '');

        if (!str_starts_with($endpoint, 'https://') || strlen($endpoint) > 2000) {
            Response::error(400, 'invalid_endpoint', 'endpoint must be an https URL.');
            return;
        }
        $point = WebPush::b64urlDecode($p256dh);
        if (strlen($point) !== 65 || $point[0] !== "\x04" || strlen(WebPush::b64urlDecode($auth)) !== 16) {
            Response::error(400, 'invalid_keys', 'keys.p256dh and keys.auth are not valid.');
            return;
        }

        // Keyed by endpoint: the same browser subscribing under another account
        // moves the row to that account, so a shared device never keeps
        // delivering the previous user's notifications.
        Database::connection()->prepare(
            'INSERT INTO push_subscriptions (id, user_id, endpoint, endpoint_hash, p256dh, auth, user_agent)
             VALUES (:id, :user_id, :endpoint, :hash, :p256dh, :auth, :ua)
             ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh),
                                     auth = VALUES(auth), user_agent = VALUES(user_agent)'
        )->execute([
            'id'       => Uuid::v4(),
            'user_id'  => $user['id'],
            'endpoint' => $endpoint,
            'hash'     => hash('sha256', $endpoint),
            'p256dh'   => $p256dh,
            'auth'     => $auth,
            'ua'       => mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255) ?: null,
        ]);

        Response::ok(['ok' => true], 201);
    }

    public static function unsubscribe(): void
    {
        $user = Auth::requireUser();
        $data = Validate::required(Validate::body(), ['endpoint']);

        Database::connection()->prepare('DELETE FROM push_subscriptions WHERE endpoint_hash = :hash AND user_id = :user_id')
            ->execute(['hash' => hash('sha256', (string) $data['endpoint']), 'user_id' => $user['id']]);

        Response::ok(['ok' => true]);
    }

    /** Sends the caller a test notification, to check that push reaches their devices. */
    public static function test(): void
    {
        $user = Auth::requireUser();

        $sent = self::sendToUser($user['id'], 'اعلان آزمایشی', 'اعلان‌ها روی این دستگاه فعال است.', '/calendar');
        if ($sent === 0) {
            Response::error(404, 'no_subscription', 'No device could be notified. Turn notifications on for this device first.');
            return;
        }

        Response::ok(['sent' => $sent]);
    }

    /**
     * Every notification row is also a push: AuthController::notify (and the
     * broadcast insert) just write the row with pushed_at NULL, and the two
     * paths below deliver it, so a notification added anywhere in the app later
     * reaches phones and desktops with no extra code.
     *
     *  - queueAfterResponse(): for a row made during a request, delivered once
     *    the response has been sent, so the user never waits on push services;
     *  - deliverPending(): the cron sweep, which catches rows nothing queued
     *    (broadcasts) and rows whose immediate delivery never ran.
     *
     * Delivery claims the row first (pushed_at = NOW() where still NULL), so
     * each notification is pushed at most once, however the paths overlap.
     * A push that fails is not retried: the notification is still in the panel.
     */
    public static function queueAfterResponse(string $notificationId): void
    {
        static $queue = [];
        static $registered = false;

        $queue[] = $notificationId;
        if ($registered) {
            return;
        }
        $registered = true;

        register_shutdown_function(static function () use (&$queue): void {
            ignore_user_abort(true);
            // PHP-FPM can hang up on the client now and keep working; elsewhere this is a no-op.
            if (function_exists('fastcgi_finish_request')) {
                fastcgi_finish_request();
            }
            foreach ($queue as $id) {
                self::deliverNotification($id);
            }
        });
    }

    /** Pushes recent notifications nobody has pushed yet; returns how many were claimed. */
    public static function deliverPending(int $limit = 200): int
    {
        try {
            $ids = Database::connection()->query(
                'SELECT id FROM notifications
                 WHERE pushed_at IS NULL AND created_at >= NOW() - INTERVAL 1 DAY
                 ORDER BY created_at LIMIT ' . $limit
            )->fetchAll(\PDO::FETCH_COLUMN);
        } catch (\Throwable $e) {
            error_log('push: ' . $e->getMessage());
            return 0;
        }

        $claimed = 0;
        foreach ($ids as $id) {
            $claimed += self::deliverNotification((string) $id) ? 1 : 0;
        }
        return $claimed;
    }

    /** Claims one notification and pushes it. False if it was gone or already pushed. */
    private static function deliverNotification(string $id): bool
    {
        try {
            $pdo = Database::connection();

            $claim = $pdo->prepare('UPDATE notifications SET pushed_at = NOW() WHERE id = :id AND pushed_at IS NULL');
            $claim->execute(['id' => $id]);
            if ($claim->rowCount() === 0) {
                return false;
            }

            $stmt = $pdo->prepare('SELECT recipient_id, title, body, link FROM notifications WHERE id = :id');
            $stmt->execute(['id' => $id]);
            $row = $stmt->fetch();
            if ($row === false) {
                return false;
            }

            self::sendToUser($row['recipient_id'], (string) $row['title'], (string) ($row['body'] ?? ''), $row['link'] ?: '/notifications');
            return true;
        } catch (\Throwable $e) {
            error_log('push: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Pushes to every device the user enabled. Returns how many the push
     * services accepted. Never throws: a broken push must not break the caller
     * (a cron run, or the notification that triggered it).
     */
    public static function sendToUser(string $userId, string $title, string $body, string $url): int
    {
        try {
            $pdo = Database::connection();
            $stmt = $pdo->prepare('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = :user_id');
            $stmt->execute(['user_id' => $userId]);
            $subscriptions = $stmt->fetchAll();
            if ($subscriptions === []) {
                return 0;
            }

            $payload = json_encode(
                ['title' => $title, 'body' => mb_substr($body, 0, 300), 'url' => $url],
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
            );
            $subject = self::subject();
            $delete = $pdo->prepare('DELETE FROM push_subscriptions WHERE id = :id');

            $sent = 0;
            foreach ($subscriptions as $subscription) {
                try {
                    $status = WebPush::send($pdo, $subscription, $payload, $subject);
                } catch (\Throwable $e) {
                    error_log('push: ' . $e->getMessage());
                    continue;
                }

                if ($status >= 200 && $status < 300) {
                    $sent++;
                } elseif ($status === 404 || $status === 410) {
                    // The browser dropped this subscription; it will never work again.
                    $delete->execute(['id' => $subscription['id']]);
                }
            }

            return $sent;
        } catch (\Throwable $e) {
            error_log('push: ' . $e->getMessage());
            return 0;
        }
    }

    private static function subject(): string
    {
        $config = require __DIR__ . '/../../config.php';
        foreach ($config['cors_origins'] ?? [] as $origin) {
            if (is_string($origin) && str_starts_with($origin, 'https://')) {
                return $origin;
            }
        }
        return self::DEFAULT_SUBJECT;
    }
}
