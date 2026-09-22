import { api } from "@/lib/api/client";
import type { AthleteDashboardData, AthletePlanSummary } from "../types/dashboard-types";

interface PlanRow {
  id: string;
  title: string;
  description: string | null;
  assigned_at: string;
}

function mapPlan(row: PlanRow | null): AthletePlanSummary | null {
  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    assignedAt: row.assigned_at,
  };
}

/** The athlete's own current plans — the API resolves them from the session. */
export async function getAthleteDashboard(): Promise<AthleteDashboardData> {
  const data = await api.get<{
    todays_workout: PlanRow | null;
    nutrition_plan: PlanRow | null;
  }>("/dashboard/athlete");

  return {
    todaysWorkout: mapPlan(data.todays_workout),
    nutritionPlan: mapPlan(data.nutrition_plan),
  };
}
