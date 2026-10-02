<?php
declare(strict_types=1);

namespace Gymlic;

use DateTimeImmutable;
use DateTimeZone;

/**
 * Weekly adherence on the server, for the Excel report. The panel counts the
 * same things in the browser (features/athletes/utils: parsePlanDescription,
 * workout-plan-weekday, streak); this is a port of just the counting, and
 * tests/training-week-parity.mjs runs both on the same plans so the two
 * can't drift apart unnoticed.
 */
final class TrainingWeek
{
    public const WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

    /** Distinct days a week needs to count toward a streak. */
    public const STREAK_MIN_SESSIONS = 3;

    private const TIMEZONE = 'Asia/Tehran';

    /** What JavaScript's trim() removes. */
    private const SPACE = '[\\s\\x{00A0}\\x{1680}\\x{2000}-\\x{200A}\\x{2028}\\x{2029}\\x{202F}\\x{205F}\\x{3000}\\x{FEFF}]';

    private function __construct()
    {
    }

    /**
     * Training days in a plan's free-text description: its headed sections
     * (a line ending in ":"), with the sections that open with the same
     * weekday counted once, as the athlete's own screen offers one tick each.
     */
    public static function sessionsPerWeek(?string $description): int
    {
        if ($description === null || trim($description) === '') {
            return 0;
        }
        $weekdays = [];
        $other = 0;
        foreach (preg_split('/\n/', $description) ?: [] as $raw) {
            $line = self::trim($raw);
            if (mb_strlen($line) <= 1 || !str_ends_with($line, ':')) {
                continue;
            }
            $weekday = self::headingWeekday(self::trim(mb_substr($line, 0, -1)));
            if ($weekday === null) {
                $other++;
            } else {
                $weekdays[$weekday] = true;
            }
        }
        return count($weekdays) + $other;
    }

    /** The weekday a heading opens with, or null (a program grouped by muscle group). */
    private static function headingWeekday(string $heading): ?string
    {
        $normalized = self::trim(str_replace("\u{200C}", '', $heading));
        foreach (self::WEEKDAYS as $weekday) {
            $name = str_replace("\u{200C}", '', $weekday);
            if (!str_starts_with($normalized, $name)) {
                continue;
            }
            // Every name ends in «شنبه»: the next character must not be a
            // Persian letter, or «سه‌شنبه» would read as Saturday.
            $next = mb_substr($normalized, mb_strlen($name), 1);
            if ($next === '' || !preg_match('/[\x{0600}-\x{06FF}]/u', $next)) {
                return $weekday;
            }
        }
        return null;
    }

    /** JavaScript's trim(): whitespace, including the non-breaking kinds. */
    private static function trim(string $text): string
    {
        return (string) preg_replace('/^' . self::SPACE . '+|' . self::SPACE . '+$/u', '', $text);
    }

    /** Today in Tehran, 'Y-m-d'. */
    public static function today(): string
    {
        return (new DateTimeImmutable('now', new DateTimeZone(self::TIMEZONE)))->format('Y-m-d');
    }

    /** The Saturday that opens the Persian week of $date ('Y-m-d'). */
    public static function weekStart(string $date): string
    {
        $day = new DateTimeImmutable($date . ' 12:00:00');
        $back = ((int) $day->format('w') + 1) % 7;
        return $day->modify("-{$back} days")->format('Y-m-d');
    }

    /**
     * Consecutive weeks with at least STREAK_MIN_SESSIONS distinct training
     * dates, ending at this week, or at last week while this one hasn't got
     * there yet (it still has days left).
     *
     * @param list<string> $dates completed_on of the athlete's ticks
     */
    public static function streak(array $dates, ?string $today = null): int
    {
        $daysByWeek = [];
        foreach ($dates as $date) {
            $daysByWeek[self::weekStart($date)][$date] = true;
        }
        $trained = [];
        foreach ($daysByWeek as $week => $days) {
            if (count($days) >= self::STREAK_MIN_SESSIONS) {
                $trained[$week] = true;
            }
        }

        $cursor = self::weekStart($today ?? self::today());
        if (!isset($trained[$cursor])) {
            $cursor = self::shift($cursor, -1);
        }
        $current = 0;
        while (isset($trained[$cursor])) {
            $current++;
            $cursor = self::shift($cursor, -1);
        }
        return $current;
    }

    public static function shift(string $weekStart, int $weeks): string
    {
        return (new DateTimeImmutable($weekStart . ' 12:00:00'))->modify(($weeks * 7) . ' days')->format('Y-m-d');
    }
}
