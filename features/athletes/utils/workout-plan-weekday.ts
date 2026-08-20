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

// Midnight on the Saturday that opens the current Persian week — the window
// a day's tick counts within, so it clears on its own when the week rolls
// over rather than staying ticked forever.
export function getPersianWeekStart(now: Date = new Date()): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((now.getDay() + 1) % 7));
  return start;
}

// "YYYY-MM-DD" in local time. toISOString() would shift the date across the
// day boundary for anyone east of UTC, filing an evening session in Tehran
// under the previous day.
export function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

// A hand-typed heading may spell "سه‌شنبه" without its ZWNJ, so both sides
// are compared with it stripped.
function normalize(value: string): string {
  return value.replace(ZWNJ, "").trim();
}

// The " — " (or "-", "،") a legacy heading put between its day and its
// muscle group.
const HEADING_SEPARATOR = /^[\s—–\-،,]+/;

// Splits a heading into the day it names and whatever label followed it, so
// a pre-existing "شنبه — پا" can be folded back into that day's block with
// "پا" applied to its exercises. Returns null when the heading doesn't start
// with a weekday at all (a program grouped purely by muscle group).
export function splitWeekdayHeading(
  heading: string
): { weekday: Weekday; label: string | null } | null {
  const weekday = headingWeekday(heading);
  if (!weekday) return null;

  const trimmed = heading.trim();
  // The heading may spell the weekday with or without its ZWNJ, so the
  // canonical form is tried first and the stripped one second.
  for (const form of [weekday, weekday.replace(ZWNJ, "")]) {
    if (trimmed.startsWith(form)) {
      const label = trimmed.slice(form.length).replace(HEADING_SEPARATOR, "").trim();
      return { weekday, label: label || null };
    }
  }

  return { weekday, label: null };
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
