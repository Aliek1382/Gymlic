import { createClient } from "@/lib/supabase/client";
import type { WorkoutDayLog } from "../types/athlete-types";

const SELECT_COLUMNS = "id, assignment_id, day_key, completed_on";

async function getCurrentUserId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("نشست کاربر معتبر نیست.");
  return user.id;
}

// Every log from `fromDate` onward, for the signed-in athlete. Callers pass
// the start of the current week, so one request covers every plan card on
// the page rather than one per plan.
export async function listDayLogsSince(fromDate: string): Promise<WorkoutDayLog[]> {
  const supabase = createClient();
  const athleteId = await getCurrentUserId();

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
