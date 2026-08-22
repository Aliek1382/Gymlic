// Lays the athlete's logged sessions out as a run of Persian weeks, so the
// tick history reads as a calendar instead of a flat list. Pure and
// date-injectable, since every boundary here is a local-time one.
import { getPersianWeekStart, toDateKey } from "./workout-plan-weekday";
import type { WorkoutDayLog } from "../types/athlete-types";

export interface CalendarDay {
  dateKey: string;
  date: Date;
  // The day_key of every session logged on this date — usually one, but a
  // plan split across two blocks can put two here.
  sessions: string[];
  isToday: boolean;
  // Days after today in the current week: rendered as placeholders rather
  // than as "missed", which they aren't yet.
  isFuture: boolean;
}

export interface CalendarWeek {
  startDateKey: string;
  days: CalendarDay[];
}

export interface TrainingCalendarData {
  weeks: CalendarWeek[];
  // Distinct dates trained across the window, and total sessions logged —
  // these differ whenever a day carried more than one block.
  activeDays: number;
  totalSessions: number;
}

const DAYS_PER_WEEK = 7;

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

// `weekCount` weeks ending with the one in progress, oldest first, so the
// grid reads top-to-bottom the way a calendar does.
export function buildTrainingCalendar(
  logs: WorkoutDayLog[],
  weekCount: number,
  now: Date = new Date()
): TrainingCalendarData {
  const sessionsByDate = new Map<string, string[]>();
  for (const log of logs) {
    const existing = sessionsByDate.get(log.completedOn);
    if (existing) existing.push(log.dayKey);
    else sessionsByDate.set(log.completedOn, [log.dayKey]);
  }

  const todayKey = toDateKey(now);
  const currentWeekStart = getPersianWeekStart(now);
  const firstWeekStart = addDays(currentWeekStart, -(weekCount - 1) * DAYS_PER_WEEK);

  const weeks: CalendarWeek[] = [];
  let activeDays = 0;
  let totalSessions = 0;

  for (let w = 0; w < weekCount; w += 1) {
    const weekStart = addDays(firstWeekStart, w * DAYS_PER_WEEK);
    const days: CalendarDay[] = [];

    for (let d = 0; d < DAYS_PER_WEEK; d += 1) {
      const date = addDays(weekStart, d);
      const dateKey = toDateKey(date);
      const sessions = sessionsByDate.get(dateKey) ?? [];

      if (sessions.length > 0) {
        activeDays += 1;
        totalSessions += sessions.length;
      }

      days.push({
        dateKey,
        date,
        sessions,
        isToday: dateKey === todayKey,
        isFuture: dateKey > todayKey,
      });
    }

    weeks.push({ startDateKey: toDateKey(weekStart), days });
  }

  return { weeks, activeDays, totalSessions };
}

// The date the window opens on — what the query filters `completed_on` by, so
// it fetches exactly what the grid will render and nothing more.
export function calendarWindowStart(
  weekCount: number,
  now: Date = new Date()
): string {
  const currentWeekStart = getPersianWeekStart(now);
  return toDateKey(addDays(currentWeekStart, -(weekCount - 1) * DAYS_PER_WEEK));
}
