import { createClient } from "@/lib/supabase/client";
import type {
  AthleteDashboardData,
  MeasurementEntry,
} from "../types/dashboard-types";

export async function getAthleteDashboard(): Promise<AthleteDashboardData> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("نشست کاربر معتبر نیست.");

  const [workout, nutrition, measurements] = await Promise.all([
    supabase
      .from("workout_assignments")
      .select("title, assigned_at")
      .eq("athlete_id", user.id)
      .eq("status", "active")
      .order("assigned_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("nutrition_assignments")
      .select("title, assigned_at")
      .eq("athlete_id", user.id)
      .eq("status", "active")
      .order("assigned_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("measurements")
      .select("id, height_cm, weight_kg, body_fat_percent, recorded_at")
      .eq("athlete_id", user.id)
      .order("recorded_at", { ascending: false })
      .limit(6),
  ]);

  const mapMeasurement = (row: {
    id: string;
    height_cm: number | null;
    weight_kg: number | null;
    body_fat_percent: number | null;
    recorded_at: string;
  }): MeasurementEntry => ({
    id: row.id,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    bodyFatPercent: row.body_fat_percent,
    recordedAt: row.recorded_at,
  });

  const history = (measurements.data ?? []).map(mapMeasurement);

  return {
    todaysWorkout: workout.data
      ? { title: workout.data.title, assignedAt: workout.data.assigned_at }
      : null,
    nutritionPlan: nutrition.data
      ? { title: nutrition.data.title, assignedAt: nutrition.data.assigned_at }
      : null,
    latestMeasurement: history[0] ?? null,
    measurementHistory: history,
  };
}
