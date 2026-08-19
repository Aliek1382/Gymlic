// Day-of-week awareness for plan sections. Nothing structured is stored —
// WorkoutDayBuilder writes the day into the same free-text heading a muscle
// group goes into ("شنبه", "شنبه — پا", "پا", or whatever a trainer types
// by hand) — so "which section is today's" is a best-effort match on that
// label rather than a lookup on a real field.
import { WEEKDAYS, type Weekday } from "./workout-plan-text";

// Zero-width non-joiner, the invisible character inside "سه‌شنبه".
const ZWNJ = /‌/g;
const PERSIAN_LETTER = /[؀-ۿ]/;

// The Persian week starts on Saturday, which getDay() (Sunday = 0) doesn't,
// so shift by one instead of indexing WEEKDAYS with getDay() directly.
export function getTodayWeekday(now: Date = new Date()): Weekday {
  return WEEKDAYS[(now.getDay() + 1) % 7];
}

// A hand-typed heading may spell "سه‌شنبه" without its ZWNJ, so both sides
// are compared with it stripped.
function normalize(value: string): string {
  return value.replace(ZWNJ, "").trim();
}

// Every weekday name ends in "شنبه", so a substring test would read
// "سه‌شنبه — پا" as Saturday's block. Matching from the start of the
// heading and requiring the next character to be a separator (the " — "
// before a muscle group, or end of string) keeps the seven distinct.
export function headingWeekday(heading: string | null): Weekday | null {
  if (!heading) return null;
  const normalized = normalize(heading);

  return (
    WEEKDAYS.find((weekday) => {
      const name = normalize(weekday);
      if (!normalized.startsWith(name)) return false;
      const next = normalized.charAt(name.length);
      return next === "" || !PERSIAN_LETTER.test(next);
    }) ?? null
  );
}
