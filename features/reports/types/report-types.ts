import type { PlanKind } from "@/features/athletes";

export interface TrainerMonthlyStatsSummary {
  athletesCount: number;
  workoutPlansThisMonth: number;
  nutritionPlansThisMonth: number;
}

export interface AthleteProgressSummary {
  athleteId: string;
  name: string;
  completedCount: number;
}

export interface CompletedPlanEntry {
  id: string;
  title: string;
  kind: PlanKind;
  assignedAt: string;
}
