export interface AthleteSummary {
  id: string;
  name: string;
  joinedAt: string;
}

export interface PendingAthleteInvite {
  id: string;
  code: string;
  name: string;
  heightCm: number | null;
  weightKg: number | null;
  createdAt: string;
  expiresAt: string;
}

export type PlanKind = "workout" | "nutrition";
