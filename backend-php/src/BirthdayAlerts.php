<?php
declare(strict_types=1);

namespace Gymlic;

use PDO;
use Throwable;

/**
 * Once a day, tells the owner on Telegram which trainers have a birthday in
 * the next few days (or today), so there is time to send them a gift code
 * (the «تولد مربی‌ها» card on the admin's front page).
 *
 * A trainer is announced once per birthday, the first day it is within the
 * window. One who already got a birthday gift code this year is
 * left out. Remembered in one app_settings row (AlertState). Rides
 * notification-dispatch.php; never throws; does nothing until the bot is set up.
 */
final class BirthdayAlerts
{
    private const STATE = 'birthdays';
    private const FROM_HOUR = 9;

    /** Days ahead to announce, today included (the admin's card shows 7). */
    private const WINDOW = 3;

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

            $state = AlertState::load($pdo, self::STATE);
            $today = date('Y-m-d');
            if (($state['day'] ?? '') === $today) {
                return null;
            }
            $year = Birthdays::jalaliYear();
            $sent = is_array($state['sent'] ?? null) ? $state['sent'] : [];

            $rows = Birthdays::trainers($pdo, self::WINDOW);
            $gifted = self::gifted($pdo, $rows, $year);
            $fresh = array_values(array_filter(
                $rows,
                static fn (array $r): bool => ($sent[$r['id']] ?? null) !== $r['date'] && !isset($gifted[$r['id']])
            ));

            $ok = true;
            if ($fresh !== []) {
                $ok = TelegramGateway::send(self::message($fresh));
                if (!$ok) {
                    error_log('telegram birthday alert: ' . TelegramGateway::lastError());
                }
            }

            // A failed send leaves them unannounced, so tomorrow retries (while still in the window).
            // Entries of birthdays already past are dropped.
            $remembered = array_filter($sent, static fn ($date): bool => is_string($date) && $date >= $today);
            if ($ok) {
                foreach ($fresh as $r) {
                    $remembered[$r['id']] = $r['date'];
                }
            }
            AlertState::save($pdo, self::STATE, ['day' => $today, 'sent' => $remembered]);

            return $fresh !== [] && $ok ? 'birthday alert: ' . count($fresh) . ' announced' : null;
        } catch (Throwable $e) {
            error_log('telegram birthday alert: ' . $e->getMessage());
            return null;
        }
    }

    /** @param list<array<string, mixed>> $rows */
    private static function message(array $rows): string
    {
        $lines = ['🎂 <b>تولد مربیان</b>'];
        foreach ($rows as $r) {
            $left = (int) $r['days_left'];
            $name = trim(((string) ($r['first_name'] ?? '')) . ' ' . ((string) ($r['last_name'] ?? '')));
            $lines[] = '';
            $lines[] = '• ' . TelegramGateway::esc($name !== '' ? $name : (string) ($r['email'] ?? '—'))
                . ' — ' . ($left === 0 ? '<b>امروز</b>' : TelegramAlerts::digits((string) $left) . ' روز دیگر')
                . ' (' . Jalali::format((string) $r['date'], true) . '، ' . TelegramAlerts::digits((string) $r['age']) . ' ساله)'
                . (($r['phone'] ?? '') !== '' ? ' — <code>' . TelegramGateway::esc((string) $r['phone']) . '</code>' : '');
        }
        $lines[] = '';
        $lines[] = '<a href="' . TelegramAlerts::SITE . '/admin">ساخت کد هدیه در پنل</a>';

        return implode("\n", $lines);
    }

    /**
     * Ids that already got a birthday gift code this Jalali year (the same
     * check as the card on the admin's front page).
     *
     * @param list<array<string, mixed>> $rows
     * @return array<string, int>
     */
    private static function gifted(PDO $pdo, array $rows, int $year): array
    {
        if ($rows === []) {
            return [];
        }
        $stmt = $pdo->prepare(
            "SELECT subject_id FROM activity_logs WHERE action = 'trainer_gift_code' AND subject_id IN ("
            . implode(',', array_fill(0, count($rows), '?')) . ')
             AND metadata LIKE ?'
        );
        $stmt->execute(array_merge(array_column($rows, 'id'), ['%"occasion":"birthday","year":' . $year . ',%']));

        return array_flip($stmt->fetchAll(PDO::FETCH_COLUMN));
    }
}
