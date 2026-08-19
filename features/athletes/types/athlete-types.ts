export interface AthleteSummary {
  id: string;
  name: string;
  // Shown on the printable plan sheet's athlete card (as an age) and avatar.
  birthDate: string | null;
  avatarUrl: string | null;
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
