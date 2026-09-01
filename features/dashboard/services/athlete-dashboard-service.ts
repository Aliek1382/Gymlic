import { createClient } from "@/lib/supabase/client";
import type { AthleteDashboardData } from "../types/dashboard-types";

export async function getAthleteDashboard(
  athleteId: string
): Promise<AthleteDashboardData> {
  const supabase = createClient();

  const [workout, nutrition] = await Promise.all([
    supabase
      .from("workout_assignments")
      .select("id, title, description, assigned_at")
      .eq("athlete_id", athleteId)
      .eq("status", "active")
      .order("assigned_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("nutrition_assignments")
      .select("id, title, description, assigned_at")
      .eq("athlete_id", athleteId)
      .eq("status", "active")
      .order("assigned_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    todaysWorkout: workout.data
      ? {
          id: workout.data.id,
          title: workout.data.title,
          description: workout.data.description,
          assignedAt: workout.data.assigned_at,
        }
      : null,
    nutritionPlan: nutrition.data
      ? {
          id: nutrition.data.id,
          title: nutrition.data.title,
          description: nutrition.data.description,
          assignedAt: nutrition.data.assigned_at,
        }
      : null,
  };
}
