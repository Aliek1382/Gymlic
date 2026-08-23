// A training streak counted in *weeks*, not days.
//
// A day-based streak is the wrong shape for a gym app: rest days are part of
// the program, so "days in a row" would break every single week and mean
// nothing. A week counts as trained when it carries at least one logged
// session, and the streak is the run of consecutive such weeks.
import {
  dateFromKey,
  getPersianWeekStart,
  toDateKey,
} from "./workout-plan-weekday";
import type { WorkoutDayLog } from "../types/athlete-types";

export interface StreakSummary {
  // Consecutive trained weeks ending at the current week — or at last week
  // while the current one is still in progress.
  current: number;
  // Longest run anywhere in the supplied logs. Bounded by whatever window
  // the caller fetched, so label it with that window.
  best: number;
}

const EMPTY: StreakSummary = { current: 0, best: 0 };

function addWeeks(date: Date, weeks: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + weeks * 7);
  return next;
}

function weekKeyOf(dateKey: string): string {
  return toDateKey(getPersianWeekStart(dateFromKey(dateKey)));
}

export function computeWeekStreak(
  logs: WorkoutDayLog[],
  now: Date = new Date()
): StreakSummary {
  if (logs.length === 0) return EMPTY;

  const trainedWeeks = new Set(logs.map((log) => weekKeyOf(log.completedOn)));

  // Longest run. Weeks are compared by key rather than by elapsed
  // milliseconds, so a DST shift can't make two adjacent weeks look apart.
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const weekKey of [...trainedWeeks].sort()) {
    const followsPrevious =
      previous !== null && toDateKey(addWeeks(dateFromKey(previous), 1)) === weekKey;
    run = followsPrevious ? run + 1 : 1;
    best = Math.max(best, run);
    previous = weekKey;
  }

  // Current run, counting backwards. A current week with nothing logged yet
  // hasn't broken anything — it just hasn't started — so the count begins at
  // last week instead of resetting to zero.
  const currentWeek = getPersianWeekStart(now);
  let cursor = trainedWeeks.has(toDateKey(currentWeek))
    ? currentWeek
    : addWeeks(currentWeek, -1);

  let current = 0;
  while (trainedWeeks.has(toDateKey(cursor))) {
    current += 1;
    cursor = addWeeks(cursor, -1);
  }

  return { current, best };
}
