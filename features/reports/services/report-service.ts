import { createClient } from "@/lib/supabase/client";
import {
  getPersianWeekStart,
  listAthletes,
  parsePlanDescription,
  toDateKey,
} from "@/features/athletes";
import type {
  AthleteProgressSummary,
  AthleteWeeklyAdherence,
  CompletedPlanEntry,
  TrainerCompletionRatesSummary,
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

// How many of this week's training days each athlete has ticked off. The
// target isn't stored anywhere — a plan's "days" are the headings inside its
// free-text description — so it's counted by parsing that description, the
// same way the athlete's own screen counts the days it offers a tick for.
export async function listWeeklyAdherence(): Promise<AthleteWeeklyAdherence[]> {
  const supabase = createClient();
  const trainerId = await getCurrentUserId();
  const weekStart = toDateKey(getPersianWeekStart());

  const [athletes, plans] = await Promise.all([
    listAthletes(),
    supabase
      .from("workout_assignments")
      .select("id, athlete_id, description")
      .eq("trainer_id", trainerId)
      .eq("is_template", false)
      .eq("status", "active")
      .order("assigned_at", { ascending: false }),
  ]);
  if (plans.error) throw plans.error;

  // The athlete's own screen ticks against their most recent active plan, so
  // adherence is measured against that same one — hence first-wins over a
  // newest-first list.
  const planByAthlete = new Map<string, { id: string; description: string | null }>();
  for (const row of plans.data ?? []) {
    if (!row.athlete_id || planByAthlete.has(row.athlete_id)) continue;
    planByAthlete.set(row.athlete_id, { id: row.id, description: row.description });
  }

  const assignmentIds = [...planByAthlete.values()].map((plan) => plan.id);
  const logs =
    assignmentIds.length > 0
      ? await supabase
          .from("workout_day_logs")
          .select("assignment_id, day_key")
          .in("assignment_id", assignmentIds)
          .gte("completed_on", weekStart)
      : null;
  if (logs?.error) throw logs.error;

  // A day ticked on two dates in one week still counts once, matching how
  // the athlete's own "this week" line counts it.
  const doneDaysByPlan = new Map<string, Set<string>>();
  for (const log of logs?.data ?? []) {
    const days = doneDaysByPlan.get(log.assignment_id) ?? new Set<string>();
    days.add(log.day_key);
    doneDaysByPlan.set(log.assignment_id, days);
  }

  return athletes.map((athlete) => {
    const plan = planByAthlete.get(athlete.id);
    if (!plan) {
      return {
        athleteId: athlete.id,
        name: athlete.name,
        doneThisWeek: 0,
        sessionsPerWeek: 0,
      };
    }

    // Only headed sections are tickable — the heading is the day's key.
    const sessionsPerWeek = parsePlanDescription(plan.description).filter(
      (section) => section.heading !== null
    ).length;

    return {
      athleteId: athlete.id,
      name: athlete.name,
      doneThisWeek: doneDaysByPlan.get(plan.id)?.size ?? 0,
      sessionsPerWeek,
    };
  });
}

export async function getTrainerCompletionRates(): Promise<TrainerCompletionRatesSummary> {
  const supabase = createClient();
  const trainerId = await getCurrentUserId();

  const [completedWorkouts, totalWorkouts, completedNutrition, totalNutrition] =
    await Promise.all([
      supabase
        .from("workout_assignments")
        .select("id", { count: "exact", head: true })
        .eq("trainer_id", trainerId)
        .eq("status", "completed")
        .eq("is_template", false),
      supabase
        .from("workout_assignments")
        .select("id", { count: "exact", head: true })
        .eq("trainer_id", trainerId)
        .neq("status", "draft")
        .eq("is_template", false),
      supabase
        .from("nutrition_assignments")
        .select("id", { count: "exact", head: true })
        .eq("trainer_id", trainerId)
        .eq("status", "completed")
        .eq("is_template", false),
      supabase
        .from("nutrition_assignments")
        .select("id", { count: "exact", head: true })
        .eq("trainer_id", trainerId)
        .neq("status", "draft")
        .eq("is_template", false),
    ]);
  if (completedWorkouts.error) throw completedWorkouts.error;
  if (totalWorkouts.error) throw totalWorkouts.error;
  if (completedNutrition.error) throw completedNutrition.error;
  if (totalNutrition.error) throw totalNutrition.error;

  return {
    workoutCompletionRate: totalWorkouts.count
      ? Math.round(((completedWorkouts.count ?? 0) / totalWorkouts.count) * 100)
      : 0,
    nutritionCompletionRate: totalNutrition.count
      ? Math.round(((completedNutrition.count ?? 0) / totalNutrition.count) * 100)
      : 0,
  };
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
