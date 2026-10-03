<?php
declare(strict_types=1);

namespace Gymlic;

use PDO;
use Throwable;

/**
 * Once a day, tells the owner on Telegram which paid subscriptions (clubs and
 * independent trainers) are about to run out, so there is time to call them
 * before they lapse. "About to run out" is the billing settings' expiring_days
 * window, the same one the trainers' own reminders use.
 *
 * Each subscription is announced once per expiry: its (id, expires_at) is
 * remembered, so the next day's message has only what is new, and a renewal
 * (a new expires_at) is announced again when its time comes. The memory is one
 * app_settings row, not a table, so no database update is needed.
 *
 * Rides notification-dispatch.php, the cron every host has. Never throws, and
 * does nothing until the bot is set up.
 */
final class ExpiryAlerts
{
    private const KEY = 'telegram.expiry';
    private const FROM_HOUR = 9;
    private const MAX_PER_GROUP = 15;

    private function __construct()
    {
    }

    /** @return string|null a line for the cron's summary, null when nothing was sent */
    public static function sendIfDue(PDO $pdo): ?string
    {
        try {
            if (!TelegramGateway::configured() || (int) date('G') < self::FROM_HOUR) {
                return null;
            }

            $state = self::load($pdo);
            $today = date('Y-m-d');
            if (($state['day'] ?? '') === $today) {
                return null;
            }
            $sent = is_array($state['sent'] ?? null) ? $state['sent'] : [];

            $window = (int) Settings::get('billing')['expiring_days'];
            $soon = date('Y-m-d H:i:s', time() + $window * 86400);
            $groups = ['club' => self::clubs($pdo, $soon), 'trainer' => self::trainers($pdo, $soon)];

            // What is in the window now, minus what was already announced for this very expiry.
            $inWindow = [];
            $fresh = ['club' => [], 'trainer' => []];
            foreach ($groups as $kind => $rows) {
                foreach ($rows as $row) {
                    $key = $kind . ':' . $row['id'];
                    $inWindow[$key] = $row['expires_at'];
                    if (($sent[$key] ?? null) !== $row['expires_at']) {
                        $fresh[$kind][] = $row;
                    }
                }
            }

            $listed = [];
            $text = $fresh['club'] === [] && $fresh['trainer'] === [] ? null : self::message($fresh, $listed);

            // A failed send leaves its subscriptions unannounced, so tomorrow retries them.
            $ok = $text === null ? true : TelegramGateway::send($text);
            if (!$ok) {
                error_log('telegram expiry alert: ' . TelegramGateway::lastError());
            }
            $remembered = [];
            foreach ($inWindow as $key => $expires) {
                if (($sent[$key] ?? null) === $expires || ($ok && isset($listed[$key]))) {
                    $remembered[$key] = $expires;
                }
            }
            self::save($pdo, ['day' => $today, 'sent' => $remembered]);

            return $text !== null && $ok ? 'expiry alert: ' . count($listed) . ' announced' : null;
        } catch (Throwable $e) {
            error_log('telegram expiry alert: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * @param array{club: list<array<string, mixed>>, trainer: list<array<string, mixed>>} $fresh
     * @param array<string, true> $listed the keys that made it into the message
     */
    private static function message(array $fresh, array &$listed): string
    {
        $lines = ['⏳ <b>اشتراک‌های نزدیک به پایان</b>'];
        $titles = ['club' => '🏢 باشگاه‌ها', 'trainer' => '👤 مربیان'];

        foreach ($fresh as $kind => $rows) {
            if ($rows === []) {
                continue;
            }
            $lines[] = '';
            $lines[] = '<b>' . $titles[$kind] . '</b>';
            foreach (array_slice($rows, 0, self::MAX_PER_GROUP) as $row) {
                $listed[$kind . ':' . $row['id']] = true;
                $days = max(1, (int) ceil((strtotime((string) $row['expires_at']) - time()) / 86400));
                $lines[] = '• ' . TelegramGateway::esc((string) $row['name'])
                    . ' — ' . TelegramGateway::esc((string) $row['plan'])
                    . ' — ' . TelegramAlerts::digits((string) $days) . ' روز دیگر (' . Jalali::format((string) $row['expires_at'], true) . ')'
                    . (($row['phone'] ?? '') !== '' ? ' — <code>' . TelegramGateway::esc((string) $row['phone']) . '</code>' : '');
            }
            if (count($rows) > self::MAX_PER_GROUP) {
                $lines[] = 'و ' . TelegramAlerts::digits((string) (count($rows) - self::MAX_PER_GROUP)) . ' مورد دیگر (در پیام‌های روزهای بعد)';
            }
        }

        $lines[] = '';
        $lines[] = '<a href="' . TelegramAlerts::SITE . '/admin/subscriptions">اشتراک باشگاه‌ها</a> · <a href="' . TelegramAlerts::SITE . '/admin/trainer-billing">اشتراک مربیان</a>';

        return implode("\n", $lines);
    }

    /** @return list<array<string, mixed>> */
    private static function clubs(PDO $pdo, string $soon): array
    {
        $stmt = $pdo->prepare(
            "SELECT c.id, c.name, s.plan_name AS plan, s.expires_at, o.phone
             FROM subscriptions s
             JOIN clubs c ON c.id = s.club_id AND c.status = 'active'
             JOIN profiles o ON o.id = c.owner_id
             WHERE s.expires_at > NOW() AND s.expires_at <= :soon
             ORDER BY s.expires_at"
        );
        $stmt->execute(['soon' => $soon]);

        return $stmt->fetchAll();
    }

    /** Independent trainers only: one in a club is covered by the club's subscription. */
    private static function trainers(PDO $pdo, string $soon): array
    {
        if (!Database::hasTable('trainer_subscriptions')) {
            return [];
        }
        $stmt = $pdo->prepare(
            "SELECT p.id, TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))) AS name,
                    s.plan_name AS plan, s.expires_at, p.phone
             FROM trainer_subscriptions s
             JOIN profiles p ON p.id = s.trainer_id AND p.account_type = 'trainer' AND p.is_suspended = 0
             WHERE s.expires_at > NOW() AND s.expires_at <= :soon
               AND NOT EXISTS (SELECT 1 FROM memberships m
                               WHERE m.user_id = s.trainer_id AND m.role = 'trainer' AND m.status = 'active')
             ORDER BY s.expires_at"
        );
        $stmt->execute(['soon' => $soon]);

        return array_map(
            static fn (array $row): array => $row + ['name' => $row['name'] !== '' ? $row['name'] : '—'],
            $stmt->fetchAll()
        );
    }

    /** @return array<string, mixed> */
    private static function load(PDO $pdo): array
    {
        $stmt = $pdo->prepare('SELECT value FROM app_settings WHERE setting_key = :key');
        $stmt->execute(['key' => self::KEY]);
        $decoded = json_decode((string) $stmt->fetchColumn(), true);

        return is_array($decoded) ? $decoded : [];
    }

    /** @param array<string, mixed> $state */
    private static function save(PDO $pdo, array $state): void
    {
        $pdo->prepare(
            'INSERT INTO app_settings (setting_key, value) VALUES (:key, :value)
             ON DUPLICATE KEY UPDATE value = VALUES(value)'
        )->execute(['key' => self::KEY, 'value' => json_encode($state, JSON_UNESCAPED_UNICODE)]);
    }
}
