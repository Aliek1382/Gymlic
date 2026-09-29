<?php
declare(strict_types=1);

namespace Gymlic;

/**
 * The calendar's recurrence rules: parsing, validation and expansion.
 *
 * A rule is one short string (calendar_events.recurrence_rule):
 *
 *   d[/N]          every day, or every N days
 *   w[/N][:list]   every week / N weeks, on the weekdays in list (0 = Sunday .. 6);
 *                  no list means the weekday of the event's own date
 *   m[/N][:list]   every month / N months, on the Jalali days of month in list (1..31);
 *                  no list means the event's own Jalali day. A day the month
 *                  doesn't have (31 in Mehr) falls on the month's last day.
 *   y[/N]          every year / N years, on the event's own Jalali month and day
 *
 * The old form "1,3,5" (weekdays only) is still read as "w:1,3,5". Weeks
 * start on Saturday, like the Jalali calendar the trainer sees, and counting
 * "every N weeks/months/years" starts from the event's own date.
 */
final class Recurrence
{
    private const MAX_INTERVAL = 99;

    /**
     * Checks a rule and returns it in canonical form, or null if it is not a valid rule.
     * The canonical form of the old weekday list is "w:list".
     */
    public static function normalize(string $rule): ?string
    {
        $spec = self::parse($rule);
        if ($spec === null) {
            return null;
        }

        $out = $spec['unit'] . ($spec['interval'] > 1 ? '/' . $spec['interval'] : '');
        if ($spec['list'] !== null) {
            $out .= ':' . implode(',', $spec['list']);
        }
        return $out;
    }

    /**
     * The dates (Y-m-d) the rule lands on inside from..to, counting from $anchor
     * (the event's own date) and stopping at $until when there is one.
     *
     * @return string[]
     */
    public static function occurrences(
        string $rule,
        \DateTimeImmutable $anchor,
        \DateTimeImmutable $from,
        \DateTimeImmutable $to,
        ?\DateTimeImmutable $until = null
    ): array {
        $spec = self::parse($rule);
        if ($spec === null) {
            return [];
        }

        $cursor = $anchor > $from ? $anchor : $from;
        $end = ($until !== null && $until < $to) ? $until : $to;

        $anchorJalali = Jalali::fromGregorian((int) $anchor->format('Y'), (int) $anchor->format('n'), (int) $anchor->format('j'));
        $anchorDay = self::dayNumber($anchor);

        $dates = [];
        for (; $cursor <= $end; $cursor = $cursor->modify('+1 day')) {
            if (self::matches($spec, $cursor, $anchor, $anchorDay, $anchorJalali)) {
                $dates[] = $cursor->format('Y-m-d');
            }
        }
        return $dates;
    }

    /** @return array{unit: string, interval: int, list: ?int[]}|null */
    private static function parse(string $rule): ?array
    {
        if (preg_match('/^[0-6](,[0-6])*$/', $rule)) {
            $rule = 'w:' . $rule; // the pre-Jalali form
        }
        if (!preg_match('/^([dwmy])(?:\/(\d{1,2}))?(?::(\d{1,2}(?:,\d{1,2})*))?$/', $rule, $m)) {
            return null;
        }

        $unit = $m[1];
        $interval = ($m[2] ?? '') === '' ? 1 : (int) $m[2];
        if ($interval < 1 || $interval > self::MAX_INTERVAL) {
            return null;
        }

        $list = null;
        if (($m[3] ?? '') !== '') {
            if ($unit !== 'w' && $unit !== 'm') {
                return null; // only weeks and months take a day list
            }
            $list = array_values(array_unique(array_map('intval', explode(',', $m[3]))));
            sort($list);

            foreach ($list as $day) {
                if ($unit === 'w' ? $day > 6 : ($day < 1 || $day > 31)) {
                    return null;
                }
            }
        }

        return ['unit' => $unit, 'interval' => $interval, 'list' => $list];
    }

    /** @param array{unit: string, interval: int, list: ?int[]} $spec  @param array{0: int, 1: int, 2: int} $anchorJalali */
    private static function matches(array $spec, \DateTimeImmutable $date, \DateTimeImmutable $anchor, int $anchorDay, array $anchorJalali): bool
    {
        $n = $spec['interval'];
        $day = self::dayNumber($date);

        switch ($spec['unit']) {
            case 'd':
                return ($day - $anchorDay) % $n === 0;

            case 'w':
                $weekdays = $spec['list'] ?? [(int) $anchor->format('w')];
                if (!in_array((int) $date->format('w'), $weekdays, true)) {
                    return false;
                }
                return (self::weekIndex($date, $day) - self::weekIndex($anchor, $anchorDay)) % $n === 0;

            case 'm':
                [$jy, $jm, $jd] = Jalali::fromGregorian((int) $date->format('Y'), (int) $date->format('n'), (int) $date->format('j'));
                $months = ($jy * 12 + $jm) - ($anchorJalali[0] * 12 + $anchorJalali[1]);
                if ($months % $n !== 0) {
                    return false;
                }
                $length = Jalali::monthLength($jy, $jm);
                foreach ($spec['list'] ?? [$anchorJalali[2]] as $wanted) {
                    if (min($wanted, $length) === $jd) {
                        return true;
                    }
                }
                return false;

            default: // 'y'
                [$jy, $jm, $jd] = Jalali::fromGregorian((int) $date->format('Y'), (int) $date->format('n'), (int) $date->format('j'));
                return $jm === $anchorJalali[1]
                    && ($jy - $anchorJalali[0]) % $n === 0
                    && $jd === min($anchorJalali[2], Jalali::monthLength($jy, $jm));
        }
    }

    /** Days since 1970-01-01, timezone-proof (the dates are calendar days, not instants). */
    private static function dayNumber(\DateTimeImmutable $date): int
    {
        return intdiv(gmmktime(0, 0, 0, (int) $date->format('n'), (int) $date->format('j'), (int) $date->format('Y')), 86400);
    }

    /** Which week (Saturday to Friday) a day falls in; 1970-01-03 was a Saturday. */
    private static function weekIndex(\DateTimeImmutable $date, int $dayNumber): int
    {
        $sinceSaturday = ((int) $date->format('w') + 1) % 7;
        return intdiv($dayNumber - $sinceSaturday - 2, 7);
    }
}
