import { createClient } from "@/lib/supabase/client";
import type { AthleteDashboardData } from "../types/dashboard-types";

export async function getAthleteDashboard(): Promise<AthleteDashboardData> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("نشست کاربر معتبر نیست.");

  const [workout, nutrition] = await Promise.all([
    supabase
      .from("workout_assignments")
      .select("title, description, assigned_at")
      .eq("athlete_id", user.id)
      .eq("status", "active")
      .order("assigned_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("nutrition_assignments")
      .select("title, description, assigned_at")
      .eq("athlete_id", user.id)
      .eq("status", "active")
      .order("assigned_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    todaysWorkout: workout.data
      ? {
          title: workout.data.title,
          description: workout.data.description,
          assignedAt: workout.data.assigned_at,
        }
      : null,
    nutritionPlan: nutrition.data
      ? {
          title: nutrition.data.title,
          description: nutrition.data.description,
          assignedAt: nutrition.data.assigned_at,
        }
      : null,
  };
}
