import { api, fullName, query, type ListResponse } from "@/lib/api/client";
import {
  calendarWindowStart,
  computeWeekStreak,
  getPersianWeekStart,
  parsePlanDescription,
  toDateKey,
  type WorkoutDayLog,
} from "@/features/athletes";
import type {
  AthleteProgressSummary,
  AthleteWeeklyAdherence,
  CompletedPlanEntry,
  TrainerCompletionRatesSummary,
  TrainerMonthlyStatsSummary,
} from "../types/report-types";

// How far back the streak query looks. Matches the training calendar's
// window, so the two never disagree about a run they both show.
const STREAK_WEEKS = 12;

export async function getTrainerMonthlyStats(): Promise<TrainerMonthlyStatsSummary> {
  const data = await api.get<{
    athletes_count: number;
    workout_plans_this_month: number;
    nutrition_plans_this_month: number;
  }>("/reports/trainer/monthly-stats");

  return {
    athletesCount: data.athletes_count,
    workoutPlansThisMonth: data.workout_plans_this_month,
    nutritionPlansThisMonth: data.nutrition_plans_this_month,
  };
}

export async function listAthleteProgress(): Promise<AthleteProgressSummary[]> {
  const data = await api.get<
    ListResponse<{
      athlete_id: string;
      first_name: string | null;
      last_name: string | null;
      completed_count: number;
    }>
  >("/reports/trainer/athlete-progress");

  return data.items.map((row) => ({
    athleteId: row.athlete_id,
    name: fullName(row.first_name, row.last_name),
    completedCount: row.completed_count,
  }));
}

interface AdherenceResponse {
  athletes: {
    athlete_id: string;
    first_name: string | null;
    last_name: string | null;
  }[];
  plans: {
    id: string;
    athlete_id: string;
    description: string | null;
  }[];
  logs: {
    athlete_id: string;
    assignment_id: string;
    day_key: string;
    completed_on: string;
  }[];
}

/**
 * How many of this week's training days each athlete has ticked off. The
 * target isn't stored anywhere — a plan's "days" are the headings inside its
 * free-text description — so it's counted by parsing that description, the
 * same way the athlete's own screen counts the days it offers a tick for.
 *
 * The API returns the raw descriptions and logs rather than a number, so this
 * parser stays the only one and can't drift from the athlete's view.
 */
export async function listWeeklyAdherence(): Promise<AthleteWeeklyAdherence[]> {
  const weekStart = toDateKey(getPersianWeekStart());

  // Logs come back over the streak window rather than just this week: a
  // streak shouldn't reset because the trainer issued a new plan, so it has
  // to see the ticks from the athlete's earlier ones too.
  const data = await api.get<AdherenceResponse>(
    `/reports/trainer/weekly-adherence${query({
      from: calendarWindowStart(STREAK_WEEKS),
    })}`
  );

  // "This week" counts only the active plan's own ticks, matching how the
  // athlete's own line counts them — and a day ticked on two dates in one
  // week still counts once.
  const doneDaysByPlan = new Map<string, Set<string>>();
  const logsByAthlete = new Map<string, WorkoutDayLog[]>();

  for (const log of data.logs) {
    if (log.completed_on >= weekStart) {
      const days = doneDaysByPlan.get(log.assignment_id) ?? new Set<string>();
      days.add(log.day_key);
      doneDaysByPlan.set(log.assignment_id, days);
    }

    const existing = logsByAthlete.get(log.athlete_id) ?? [];
    existing.push({
      id: `${log.assignment_id}-${log.day_key}-${log.completed_on}`,
      assignmentId: log.assignment_id,
      dayKey: log.day_key,
      completedOn: log.completed_on,
    });
    logsByAthlete.set(log.athlete_id, existing);
  }

  const planByAthlete = new Map(data.plans.map((plan) => [plan.athlete_id, plan]));

  // Every athlete on the roster appears, including one with no active plan —
  // measured against zero sessions rather than left out of the report.
  return data.athletes.map((athlete) => {
    const streak = computeWeekStreak(logsByAthlete.get(athlete.athlete_id) ?? []);
    const plan = planByAthlete.get(athlete.athlete_id);
    const name = fullName(athlete.first_name, athlete.last_name);

    if (!plan) {
      return {
        athleteId: athlete.athlete_id,
        name,
        doneThisWeek: 0,
        sessionsPerWeek: 0,
        streakWeeks: streak.current,
      };
    }

    // Only headed sections are tickable — the heading is the day's key.
    const sessionsPerWeek = parsePlanDescription(plan.description).filter(
      (section) => section.heading !== null
    ).length;

    return {
      athleteId: athlete.athlete_id,
      name,
      doneThisWeek: doneDaysByPlan.get(plan.id)?.size ?? 0,
      sessionsPerWeek,
      streakWeeks: streak.current,
    };
  });
}

export async function getTrainerCompletionRates(): Promise<TrainerCompletionRatesSummary> {
  const data = await api.get<{
    workout_completion_rate: number;
    nutrition_completion_rate: number;
  }>("/reports/trainer/completion-rates");

  return {
    workoutCompletionRate: data.workout_completion_rate,
    nutritionCompletionRate: data.nutrition_completion_rate,
  };
}

export async function listCompletedPlansForAthlete(
  athleteId: string
): Promise<CompletedPlanEntry[]> {
  const data = await api.get<
    ListResponse<{ id: string; title: string; kind: "workout" | "nutrition"; assigned_at: string }>
  >(`/athletes/${athleteId}/completed-plans`);

  return data.items.map((row) => ({
    id: row.id,
    title: row.title,
    kind: row.kind,
    assignedAt: row.assigned_at,
  }));
}
