import { createClient } from "@/lib/supabase/client";
import { computeWeekStreak } from "../utils/streak";
import { calendarWindowStart } from "../utils/training-calendar";
import type { WorkoutDayLog } from "../types/athlete-types";

const SELECT_COLUMNS = "id, assignment_id, day_key, completed_on";

// Matches the training calendar's own window, so a streak shown here never
// disagrees with the one on that athlete's calendar.
const STREAK_WEEKS = 12;

async function getCurrentUserId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("نشست کاربر معتبر نیست.");
  return user.id;
}

// Every log from `fromDate` onward. Defaults to the signed-in athlete — the
// week query on the plan cards passes nothing, so one request covers every
// card rather than one per plan. The history view passes an id explicitly,
// which also lets a trainer read their own athlete's logs (the select policy
// admits is_trainer_of).
export async function listDayLogsSince(
  fromDate: string,
  forAthleteId?: string
): Promise<WorkoutDayLog[]> {
  const supabase = createClient();
  const athleteId = forAthleteId ?? (await getCurrentUserId());

  const { data, error } = await supabase
    .from("workout_day_logs")
    .select(SELECT_COLUMNS)
    .eq("athlete_id", athleteId)
    .gte("completed_on", fromDate)
    .order("completed_on", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => ({
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
  const supabase = createClient();
  const athleteId = await getCurrentUserId();

  const { error } = await supabase.from("workout_day_logs").insert({
    assignment_id: assignmentId,
    athlete_id: athleteId,
    day_key: dayKey,
    completed_on: completedOn,
  });
  if (error) throw error;
}

export interface AthleteStreak {
  athleteId: string;
  streakWeeks: number;
}

// One request for every athlete's streak rather than one per row — for the
// trainer's athlete list, where all of them render at once. The select
// policy admits is_trainer_of, so this reads fine for any of the caller's
// own athletes.
export async function listStreaksForAthletes(
  athleteIds: string[]
): Promise<AthleteStreak[]> {
  if (athleteIds.length === 0) return [];

  const supabase = createClient();
  const fromDate = calendarWindowStart(STREAK_WEEKS);

  const { data, error } = await supabase
    .from("workout_day_logs")
    .select("athlete_id, day_key, completed_on")
    .in("athlete_id", athleteIds)
    .gte("completed_on", fromDate);
  if (error) throw error;

  const logsByAthlete = new Map<string, WorkoutDayLog[]>();
  for (const row of data ?? []) {
    const existing = logsByAthlete.get(row.athlete_id) ?? [];
    existing.push({
      id: `${row.athlete_id}-${row.day_key}-${row.completed_on}`,
      assignmentId: "",
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

// .select().single() after the delete forces an error when RLS silently
// excluded the row instead of quietly no-op'ing.
export async function deleteWorkoutDayLog(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("workout_day_logs")
    .delete()
    .eq("id", id)
    .select("id")
    .single();
  if (error) throw error;
}
