export interface AthleteSummary {
  id: string;
  name: string;
  joinedAt: string;
  workoutPlanCount: number;
  nutritionPlanCount: number;
}

export interface PendingAthleteInvite {
  id: string;
  code: string;
  name: string;
  heightCm: number | null;
  weightKg: number | null;
  createdAt: string;
  expiresAt: string;
  workoutPlanCount: number;
  nutritionPlanCount: number;
}

export type PlanKind = "workout" | "nutrition";

export type PlanTarget = { athleteId: string } | { invitationId: string };

export interface PlanTemplate {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
}
