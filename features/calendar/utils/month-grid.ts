import { WEEKDAYS } from "@/features/athletes/utils/workout-plan-text";
import { jalaliMonthLength, jalaliToGregorian } from "@/lib/persian";

export { WEEKDAYS };

/** One-letter headers for the narrow phone columns, in the same Saturday-first order as WEEKDAYS. */
export const WEEKDAYS_SHORT = ["ش", "ی", "د", "س", "چ", "پ", "ج"] as const;

const DAY_MS = 86_400_000;

export interface MonthDay {
  /** Jalali day of month, 1-based. */
  jd: number;
  /** The same day, Gregorian "YYYY-MM-DD" — the key events are matched on. */
  iso: string;
  /** PHP/JS weekday number, 0 = Sunday. */
  weekday: number;
}

export interface MonthGrid {
  /** Empty cells before day 1, so it lands under the right weekday (the week starts on Saturday). */
  leadingBlanks: number;
  days: MonthDay[];
  from: string;
  to: string;
}

// jalaliToGregorian returns UTC midnight, so UTC getters and toISOString give
// back the exact Gregorian day with no timezone shift.
function utcIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildMonthGrid(jy: number, jm: number): MonthGrid {
  const length = jalaliMonthLength(jy, jm);
  const first = jalaliToGregorian(jy, jm, 1);

  const days: MonthDay[] = Array.from({ length }, (_, i) => {
    const date = new Date(first.getTime() + i * DAY_MS);
    return { jd: i + 1, iso: utcIso(date), weekday: date.getUTCDay() };
  });

  return {
    // WEEKDAYS starts at Saturday, JS getUTCDay() at Sunday: shift by one.
    leadingBlanks: (first.getUTCDay() + 1) % 7,
    days,
    from: days[0].iso,
    to: days[days.length - 1].iso,
  };
}

export function shiftMonth(jy: number, jm: number, delta: 1 | -1): { jy: number; jm: number } {
  const index = jy * 12 + (jm - 1) + delta;
  return { jy: Math.floor(index / 12), jm: (index % 12) + 1 };
}
