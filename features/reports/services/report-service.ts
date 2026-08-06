import { createClient } from "@/lib/supabase/client";
import { listAthletes } from "@/features/athletes";
import type {
  AthleteProgressSummary,
  CompletedPlanEntry,
  TrainerMonthlyStatsSummary,
} from "../types/report-types";

async function getCurrentUserId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("نشست کاربر معتبر نیست.");
  return user.id;
}

export async function getTrainerMonthlyStats(): Promise<TrainerMonthlyStatsSummary> {
  const supabase = createClient();
  const trainerId = await getCurrentUserId();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [athletes, workouts, nutrition] = await Promise.all([
    supabase
      .from("trainer_athletes")
      .select("id", { count: "exact", head: true })
      .eq("trainer_id", trainerId)
      .eq("status", "active"),
    supabase
      .from("workout_assignments")
      .select("id", { count: "exact", head: true })
      .eq("trainer_id", trainerId)
      .eq("is_template", false)
      .neq("status", "draft")
      .gte("assigned_at", monthStart.toISOString()),
    supabase
      .from("nutrition_assignments")
      .select("id", { count: "exact", head: true })
      .eq("trainer_id", trainerId)
      .eq("is_template", false)
      .neq("status", "draft")
      .gte("assigned_at", monthStart.toISOString()),
  ]);
  if (athletes.error) throw athletes.error;
  if (workouts.error) throw workouts.error;
  if (nutrition.error) throw nutrition.error;

  return {
    athletesCount: athletes.count ?? 0,
    workoutPlansThisMonth: workouts.count ?? 0,
    nutritionPlansThisMonth: nutrition.count ?? 0,
  };
}

export async function listAthleteProgress(): Promise<AthleteProgressSummary[]> {
  const supabase = createClient();
  const trainerId = await getCurrentUserId();

  const [athletes, workouts, nutrition] = await Promise.all([
    listAthletes(),
    supabase
      .from("workout_assignments")
      .select("athlete_id")
      .eq("trainer_id", trainerId)
      .eq("status", "completed"),
    supabase
      .from("nutrition_assignments")
      .select("athlete_id")
      .eq("trainer_id", trainerId)
      .eq("status", "completed"),
  ]);
  if (workouts.error) throw workouts.error;
  if (nutrition.error) throw nutrition.error;

  const counts = new Map<string, number>();
  for (const row of [...(workouts.data ?? []), ...(nutrition.data ?? [])]) {
    if (!row.athlete_id) continue;
    counts.set(row.athlete_id, (counts.get(row.athlete_id) ?? 0) + 1);
  }

  return athletes.map((athlete) => ({
    athleteId: athlete.id,
    name: athlete.name,
    completedCount: counts.get(athlete.id) ?? 0,
  }));
}

export async function listCompletedPlansForAthlete(
  athleteId: string
): Promise<CompletedPlanEntry[]> {
  const supabase = createClient();
  const trainerId = await getCurrentUserId();

  const [workouts, nutrition] = await Promise.all([
    supabase
      .from("workout_assignments")
      .select("id, title, assigned_at")
      .eq("trainer_id", trainerId)
      .eq("athlete_id", athleteId)
      .eq("status", "completed"),
    supabase
      .from("nutrition_assignments")
      .select("id, title, assigned_at")
      .eq("trainer_id", trainerId)
      .eq("athlete_id", athleteId)
      .eq("status", "completed"),
  ]);
  if (workouts.error) throw workouts.error;
  if (nutrition.error) throw nutrition.error;

  const combined: CompletedPlanEntry[] = [
    ...(workouts.data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      kind: "workout" as const,
      assignedAt: row.assigned_at,
    })),
    ...(nutrition.data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      kind: "nutrition" as const,
      assignedAt: row.assigned_at,
    })),
  ];

  return combined.sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));
}
