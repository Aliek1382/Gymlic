<?php
declare(strict_types=1);

namespace Gymlic;

/**
 * Gregorian -> Jalali (Solar Hijri) date conversion. The API stores and
 * exchanges Gregorian dates only; the one place the server needs Jalali is
 * expanding "every month on day N" and "every year" calendar recurrences,
 * which must follow the Jalali calendar the trainer sees. This is the
 * jalaali-js algorithm (valid for Jalali years -61..3177).
 */
final class Jalali
{
    private const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];

    /** @return array{0: int, 1: int, 2: int} [year, month, day] */
    public static function fromGregorian(int $gy, int $gm, int $gd): array
    {
        $jdn = self::gregorianToJdn($gy, $gm, $gd);
        $jy = $gy - 621;
        $cal = self::cal($jy);
        $jdn1f = self::gregorianToJdn($gy, 3, $cal['march']);

        $k = $jdn - $jdn1f;
        if ($k >= 0) {
            if ($k <= 185) {
                return [$jy, 1 + intdiv($k, 31), $k % 31 + 1];
            }
            $k -= 186;
        } else {
            $jy--;
            $k += 179;
            if ($cal['leap'] === 1) {
                $k++;
            }
        }

        return [$jy, 7 + intdiv($k, 30), $k % 30 + 1];
    }

    /**
     * "1405/07/09" (or with Persian digits) for a stored DATETIME/DATE,
     * '' for null. Only the calendar day is converted; the time is dropped.
     */
    public static function format(?string $datetime, bool $persianDigits = false): string
    {
        if ($datetime === null || $datetime === '' || !preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $datetime, $m)) {
            return '';
        }
        [$jy, $jm, $jd] = self::fromGregorian((int) $m[1], (int) $m[2], (int) $m[3]);
        $text = sprintf('%04d/%02d/%02d', $jy, $jm, $jd);
        return $persianDigits
            ? strtr($text, ['0' => '۰', '1' => '۱', '2' => '۲', '3' => '۳', '4' => '۴', '5' => '۵', '6' => '۶', '7' => '۷', '8' => '۸', '9' => '۹'])
            : $text;
    }

    public const MONTH_NAMES = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

    /** 'Y-m-d' of the first day of the Jalali month $date ('Y-m-d', default today in Tehran) falls in. */
    public static function monthStart(?string $date = null): string
    {
        $day = new \DateTimeImmutable(($date ?? (new \DateTimeImmutable('now', new \DateTimeZone('Asia/Tehran')))->format('Y-m-d')) . ' 12:00:00');
        [, , $jd] = self::fromGregorian((int) $day->format('Y'), (int) $day->format('n'), (int) $day->format('j'));
        return $day->modify('-' . ($jd - 1) . ' days')->format('Y-m-d');
    }

    /** «مهر 1405» for a 'Y-m-d' date. */
    public static function monthLabel(string $date): string
    {
        [$jy, $jm] = self::fromGregorian((int) substr($date, 0, 4), (int) substr($date, 5, 2), (int) substr($date, 8, 2));
        return self::MONTH_NAMES[$jm - 1] . ' ' . $jy;
    }

    public static function isLeapYear(int $jy): bool
    {
        return self::cal($jy)['leap'] === 0;
    }

    public static function monthLength(int $jy, int $jm): int
    {
        if ($jm <= 6) {
            return 31;
        }
        if ($jm <= 11) {
            return 30;
        }
        return self::isLeapYear($jy) ? 30 : 29;
    }

    /** @return array{leap: int, gy: int, march: int} */
    private static function cal(int $jy): array
    {
        $bl = count(self::BREAKS);
        $gy = $jy + 621;
        $leapJ = -14;
        $jp = self::BREAKS[0];
        $jump = 0;

        if ($jy < $jp || $jy >= self::BREAKS[$bl - 1]) {
            throw new \InvalidArgumentException("Jalali year {$jy} is out of range.");
        }

        for ($i = 1; $i < $bl; $i++) {
            $jm = self::BREAKS[$i];
            $jump = $jm - $jp;
            if ($jy < $jm) {
                break;
            }
            $leapJ += intdiv($jump, 33) * 8 + intdiv($jump % 33, 4);
            $jp = $jm;
        }

        $n = $jy - $jp;
        $leapJ += intdiv($n, 33) * 8 + intdiv($n % 33 + 3, 4);
        if ($jump % 33 === 4 && $jump - $n === 4) {
            $leapJ++;
        }

        $leapG = intdiv($gy, 4) - intdiv((intdiv($gy, 100) + 1) * 3, 4) - 150;
        $march = 20 + $leapJ - $leapG;

        if ($jump - $n < 6) {
            $n = $n - $jump + intdiv($jump + 4, 33) * 33;
        }
        // PHP's % keeps the dividend's sign, like JS, so -1 is reachable here too.
        $leap = (($n + 1) % 33 - 1) % 4;
        if ($leap === -1) {
            $leap = 4;
        }

        return ['leap' => $leap, 'gy' => $gy, 'march' => $march];
    }

    private static function gregorianToJdn(int $gy, int $gm, int $gd): int
    {
        $d = intdiv(intdiv($gy + intdiv($gm - 8, 6) + 100100, 1) * 1461, 4)
            + intdiv(153 * (($gm + 9) % 12) + 2, 5) + $gd - 34840408;

        return $d - intdiv(intdiv($gy + 100100 + intdiv($gm - 8, 6), 100) * 3, 4) + 752;
    }
}
