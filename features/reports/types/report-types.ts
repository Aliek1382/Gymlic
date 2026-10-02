import type { PlanKind } from "@/features/athletes";

export interface TrainerMonthlyStatsSummary {
  athletesCount: number;
  /** null when the trainer's plan doesn't open monthly stats (locked). */
  workoutPlansThisMonth: number | null;
  nutritionPlansThisMonth: number | null;
  locked: boolean;
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

// How many of this week's training days an athlete has ticked off, against
// how many their active plan actually has. `sessionsPerWeek` is 0 when the
// athlete has no active workout plan to be measured against at all.
export interface AthleteWeeklyAdherence {
  athleteId: string;
  name: string;
  doneThisWeek: number;
  sessionsPerWeek: number;
  // Consecutive weeks meeting STREAK_MIN_SESSIONS, ending at the current week
  // (or last week while this one is still in progress). See computeWeekStreak
  // for the threshold and the in-progress rule.
  streakWeeks: number;
}

export interface TrainerCompletionRatesSummary {
  workoutCompletionRate: number;
  nutritionCompletionRate: number;
}
