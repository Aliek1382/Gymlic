import { api, query, type ListResponse } from "@/lib/api/client";
import { computeWeekStreak } from "../utils/streak";
import { calendarWindowStart } from "../utils/training-calendar";
import type { WorkoutDayLog } from "../types/athlete-types";

// Matches the training calendar's own window, so a streak shown here never
// disagrees with the one on that athlete's calendar.
const STREAK_WEEKS = 12;

interface DayLogRow {
  id: string;
  assignment_id: string;
  athlete_id: string;
  day_key: string;
  completed_on: string;
}

// Every log from `fromDate` onward. Defaults to the signed-in athlete — the
// week query on the plan cards passes nothing, so one request covers every
// card rather than one per plan. The history view passes an id explicitly,
// which also lets a trainer read their own athlete's logs.
export async function listDayLogsSince(
  fromDate: string,
  forAthleteId?: string
): Promise<WorkoutDayLog[]> {
  const data = await api.get<ListResponse<DayLogRow>>(
    `/workout-day-logs${query({ from: fromDate, athlete_id: forAthleteId })}`
  );

  return data.items.map((row) => ({
    id: row.id,
    assignmentId: row.assignment_id,
    dayKey: row.day_key,
    completedOn: row.completed_on,
  }));
}

export async function logWorkoutDay(
  assignmentId: string,
  dayKey: string,
  completedOn: string
): Promise<void> {
  await api.post("/workout-day-logs", {
    assignment_id: assignmentId,
    day_key: dayKey,
    completed_on: completedOn,
  });
}

export interface AthleteStreak {
  athleteId: string;
  streakWeeks: number;
}

// One request for every athlete's streak rather than one per row — for the
// trainer's athlete list, where all of them render at once.
export async function listStreaksForAthletes(
  athleteIds: string[]
): Promise<AthleteStreak[]> {
  if (athleteIds.length === 0) return [];

  const data = await api.get<ListResponse<DayLogRow>>(
    `/workout-day-logs${query({
      from: calendarWindowStart(STREAK_WEEKS),
      athlete_ids: athleteIds.join(","),
    })}`
  );

  const logsByAthlete = new Map<string, WorkoutDayLog[]>();
  for (const row of data.items) {
    const existing = logsByAthlete.get(row.athlete_id) ?? [];
    existing.push({
      id: row.id,
      assignmentId: row.assignment_id,
      dayKey: row.day_key,
      completedOn: row.completed_on,
    });
    logsByAthlete.set(row.athlete_id, existing);
  }

  return athleteIds.map((athleteId) => ({
    athleteId,
    streakWeeks: computeWeekStreak(logsByAthlete.get(athleteId) ?? []).current,
  }));
}

export async function deleteWorkoutDayLog(id: string): Promise<void> {
  await api.delete(`/workout-day-logs/${id}`);
}
