<?php
declare(strict_types=1);

namespace Gymlic;

use DateTimeImmutable;
use DateTimeZone;
use PDO;

/**
 * «یادآور تولد شاگردها». An athlete's birthday is their Jalali month and day
 * (the date they picked on the Jalali calendar), so it falls on a different
 * Gregorian day from year to year. An Esfand 30 birthday is kept on Esfand
 * 29 in a year that has no 30th.
 *
 * The trainer sees the coming week's birthdays on the dashboard, and on the
 * day itself gets one notification per athlete, from 8 in the morning
 * (Tehran): sent by the calendar-reminders cron, and also when the trainer
 * opens the dashboard, so it arrives on a host whose cron isn't set up.
 * Once per athlete per Jalali year (marked in the notification's metadata).
 */
final class Birthdays
{
    private const TIMEZONE = 'Asia/Tehran';

    /** The hour (Tehran) from which the day's notifications go out. */
    private const SEND_FROM_HOUR = 8;

    private function __construct()
    {
    }

    /**
     * The trainer's active athletes with a birthday in the next $days days
     * (0 = today), soonest first.
     *
     * @return list<array{athlete_id: string, first_name: ?string, last_name: ?string, birth_date: string,
     *                    date: string, days_left: int, age: int}>
     */
    public static function upcoming(PDO $pdo, string $trainerId, int $days = 7): array
    {
        $stmt = $pdo->prepare(
            "SELECT p.id, p.first_name, p.last_name, p.birth_date
             FROM trainer_athletes ta JOIN profiles p ON p.id = ta.athlete_id
             WHERE ta.trainer_id = :t AND ta.status = 'active' AND p.birth_date IS NOT NULL"
            . (Database::hasColumn('trainer_athletes', 'suspended_by_plan') ? ' AND ta.suspended_by_plan = 0' : '')
        );
        $stmt->execute(['t' => $trainerId]);
        $athletes = $stmt->fetchAll();
        if ($athletes === []) {
            return [];
        }

        $today = new DateTimeImmutable('today', new DateTimeZone(self::TIMEZONE));
        $out = [];
        for ($d = 0; $d <= $days; $d++) {
            $day = $today->modify("+{$d} days");
            [$jy, $jm, $jd] = Jalali::fromGregorian((int) $day->format('Y'), (int) $day->format('n'), (int) $day->format('j'));
            foreach ($athletes as $a) {
                [$by, $bm, $bd] = self::jalaliOf((string) $a['birth_date']);
                if ($bm === 0 || $jy <= $by || !self::falls($jy, $jm, $jd, $bm, $bd)) {
                    continue;
                }
                $out[] = [
                    'athlete_id' => $a['id'],
                    'first_name' => $a['first_name'],
                    'last_name'  => $a['last_name'],
                    'birth_date' => substr((string) $a['birth_date'], 0, 10),
                    'date'       => $day->format('Y-m-d'),
                    'days_left'  => $d,
                    'age'        => $jy - $by,
                ];
            }
        }
        return $out;
    }

    /**
     * Today's birthday notifications that haven't gone out yet: for one
     * trainer, or for every trainer (the cron). Returns how many were sent.
     */
    public static function sendDue(PDO $pdo, ?string $trainerId = null): int
    {
        $now = new DateTimeImmutable('now', new DateTimeZone(self::TIMEZONE));
        if ((int) $now->format('G') < self::SEND_FROM_HOUR) {
            return 0;
        }
        [$jy] = Jalali::fromGregorian((int) $now->format('Y'), (int) $now->format('n'), (int) $now->format('j'));

        if ($trainerId !== null) {
            $trainers = [$trainerId];
        } else {
            $trainers = $pdo->query(
                "SELECT DISTINCT ta.trainer_id FROM trainer_athletes ta JOIN profiles p ON p.id = ta.athlete_id
                 WHERE ta.status = 'active' AND p.birth_date IS NOT NULL"
            )->fetchAll(PDO::FETCH_COLUMN);
        }

        $sent = 0;
        $already = $pdo->prepare(
            "SELECT COUNT(*) FROM notifications WHERE recipient_id = :t AND type = 'athlete_birthday' AND metadata LIKE :m"
        );
        foreach ($trainers as $tid) {
            foreach (self::upcoming($pdo, (string) $tid, 0) as $b) {
                // The athlete and the Jalali year, as written by json_encode below.
                $mark = '{"athlete_id":"' . $b['athlete_id'] . '","year":' . $jy . '}';
                $already->execute(['t' => $tid, 'm' => $mark]);
                if ((int) $already->fetchColumn() > 0) {
                    continue;
                }
                $name = trim(($b['first_name'] ?? '') . ' ' . ($b['last_name'] ?? '')) ?: 'یکی از ورزشکاران';
                if (Templates::notify($pdo, 'athlete_birthday', (string) $tid, null, 'athlete_birthday', [
                    'name' => $name,
                    'age'  => self::fa($b['age']),
                ], '/athletes/profile?id=' . $b['athlete_id'], ['athlete_id' => $b['athlete_id'], 'year' => $jy])) {
                    $sent++;
                }
            }
        }
        return $sent;
    }

    /** Whether a birthday on Jalali $bm/$bd falls on $jy/$jm/$jd. */
    private static function falls(int $jy, int $jm, int $jd, int $bm, int $bd): bool
    {
        if ($bm === $jm && $bd === $jd) {
            return true;
        }
        // Esfand 30 in a year without one: Esfand 29.
        return $bm === 12 && $bd === 30 && $jm === 12 && $jd === 29 && Jalali::monthLength($jy, 12) === 29;
    }

    /** @return array{0: int, 1: int, 2: int} [year, month, day]; month 0 for an unreadable date */
    private static function jalaliOf(string $date): array
    {
        if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $date, $m) || (int) $m[1] < 1800) {
            return [0, 0, 0];
        }
        return Jalali::fromGregorian((int) $m[1], (int) $m[2], (int) $m[3]);
    }

    private static function fa(int $n): string
    {
        return strtr((string) $n, ['0' => '۰', '1' => '۱', '2' => '۲', '3' => '۳', '4' => '۴', '5' => '۵', '6' => '۶', '7' => '۷', '8' => '۸', '9' => '۹']);
    }
}
