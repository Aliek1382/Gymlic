// A training streak counted in *weeks*, not days.
//
// A day-based streak is the wrong shape for a gym app: rest days are part of
// the program, so "days in a row" would break every single week and mean
// nothing. A week counts as trained when it carries at least
// STREAK_MIN_SESSIONS logged sessions, and the streak is the run of
// consecutive such weeks.
import {
  dateFromKey,
  getPersianWeekStart,
  toDateKey,
} from "./workout-plan-weekday";
import type { WorkoutDayLog } from "../types/athlete-types";

// Sessions a week needs before it counts toward the streak. Distinct *days*,
// so a day ticked twice (a plan split across two blocks) doesn't inflate it.
export const STREAK_MIN_SESSIONS = 3;

export interface StreakSummary {
  // Consecutive qualifying weeks ending at the current week — or at last week
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

  // Distinct dates per week, not raw log count: a day ticked twice because
  // the plan splits it across two blocks is still one trip to the gym, and
  // shouldn't count as two toward the threshold.
  const daysByWeek = new Map<string, Set<string>>();
  for (const log of logs) {
    const weekKey = weekKeyOf(log.completedOn);
    const days = daysByWeek.get(weekKey) ?? new Set<string>();
    days.add(log.completedOn);
    daysByWeek.set(weekKey, days);
  }

  const trainedWeeks = new Set(
    [...daysByWeek.entries()]
      .filter(([, days]) => days.size >= STREAK_MIN_SESSIONS)
      .map(([weekKey]) => weekKey)
  );
  if (trainedWeeks.size === 0) return EMPTY;

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

  // Current run, counting backwards. The current week never breaks a streak,
  // however few sessions it holds so far — right up to Friday night there is
  // still time to train and reach the threshold, so calling it broken early
  // would be wrong. It simply doesn't contribute until it qualifies, and the
  // run ends at the first *fully past* week that fell short.
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
