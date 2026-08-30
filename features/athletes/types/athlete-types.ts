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

// One "I trained today" tick. `dayKey` is the plan section heading the tick
// belongs to and `completedOn` the local date it was made, so a weekly plan's
// ticks clear when the week rolls over instead of sticking permanently.
export interface WorkoutDayLog {
  id: string;
  assignmentId: string;
  dayKey: string;
  completedOn: string;
}

export type PlanTarget = { athleteId: string } | { invitationId: string };

export interface PlanTemplate {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
}

// One message in the back-and-forth on an assigned plan — a trainer and
// athlete telling each other things like "برنامه این هفته خیلی سخته" or
// "این حرکت برام درد داشت".
export interface PlanComment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  body: string;
  createdAt: string;
}
