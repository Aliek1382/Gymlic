import { createClient } from "@/lib/supabase/client";
import type {
  TrainerActivityItem,
  TrainerStatistics,
} from "../types/dashboard-types";

export async function getTrainerStatistics(): Promise<TrainerStatistics> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("نشست کاربر معتبر نیست.");

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [athletes, activeWorkouts, todaysWorkouts, activeNutrition] =
    await Promise.all([
      supabase
        .from("trainer_athletes")
        .select("id", { count: "exact", head: true })
        .eq("trainer_id", user.id)
        .eq("status", "active"),
      supabase
        .from("workout_assignments")
        .select("id", { count: "exact", head: true })
        .eq("trainer_id", user.id)
        .eq("status", "active"),
      supabase
        .from("workout_assignments")
        .select("id", { count: "exact", head: true })
        .eq("trainer_id", user.id)
        .eq("status", "active")
        .gte("assigned_at", todayStart.toISOString()),
      supabase
        .from("nutrition_assignments")
        .select("id", { count: "exact", head: true })
        .eq("trainer_id", user.id)
        .eq("status", "active"),
    ]);

  return {
    athletesCount: athletes.count ?? 0,
    activeWorkoutProgramsCount: activeWorkouts.count ?? 0,
    todaysWorkoutsCount: todaysWorkouts.count ?? 0,
    activeNutritionPlansCount: activeNutrition.count ?? 0,
  };
}

export async function getTrainerRecentActivities(
  limit = 10
): Promise<TrainerActivityItem[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("نشست کاربر معتبر نیست.");

  const [workouts, nutrition] = await Promise.all([
    supabase
      .from("workout_assignments")
      .select("id, title, status, assigned_at, profiles(first_name, last_name)")
      .eq("trainer_id", user.id)
      .order("assigned_at", { ascending: false })
      .limit(limit),
    supabase
      .from("nutrition_assignments")
      .select("id, title, status, assigned_at, profiles(first_name, last_name)")
      .eq("trainer_id", user.id)
      .order("assigned_at", { ascending: false })
      .limit(limit),
  ]);

  const mapRow = (
    row: {
      id: string;
      title: string;
      status: string;
      assigned_at: string;
      profiles: unknown;
    },
    type: "workout" | "nutrition"
  ): TrainerActivityItem => {
    const profile = row.profiles as unknown as {
      first_name: string | null;
      last_name: string | null;
    } | null;
    return {
      id: `${type}-${row.id}`,
      athleteName:
        [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
        "ورزشکار",
      title: row.title,
      type,
      status: row.status === "cancelled" ? "cancelled" : "active",
      date: row.assigned_at,
    };
  };

  const combined = [
    ...(workouts.data ?? []).map((row) => mapRow(row, "workout")),
    ...(nutrition.data ?? []).map((row) => mapRow(row, "nutrition")),
  ];

  return combined
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
}
