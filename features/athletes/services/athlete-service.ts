import type { PlanInvoiceSummary } from "@/features/invoices/types/invoice-types";
import { api, fullName, query, type ListResponse } from "@/lib/api/client";
import type {
  AthleteProfile,
  AthleteSummary,
  PendingAthleteInvite,
  PlanKind,
  PlanTarget,
  PlanTemplate,
  TrainerClub,
} from "../types/athlete-types";

interface AthleteRow {
  id: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  avatar_url: string | null;
  workout_plan_count: number;
  nutrition_plan_count: number;
}

export async function listAthletes(): Promise<AthleteSummary[]> {
  const data = await api.get<ListResponse<AthleteRow>>("/athletes");

  return data.items.map((row) => ({
    id: row.id,
    name: fullName(row.first_name, row.last_name),
    birthDate: row.birth_date,
    avatarUrl: row.avatar_url,
    joinedAt: row.created_at,
    workoutPlanCount: row.workout_plan_count,
    nutritionPlanCount: row.nutrition_plan_count,
  }));
}

export async function getAthleteProfile(
  athleteId: string
): Promise<AthleteProfile | null> {
  try {
    const row = await api.get<{
      id: string;
      created_at: string;
      note: string | null;
      first_name: string | null;
      last_name: string | null;
      birth_date: string | null;
      avatar_url: string | null;
      phone: string | null;
      daily_calorie_goal?: number | null;
      protein_percent?: number | null;
      carbs_percent?: number | null;
      fat_percent?: number | null;
    }>(`/athletes/${athleteId}`);

    return {
      id: row.id,
      name: fullName(row.first_name, row.last_name),
      birthDate: row.birth_date,
      avatarUrl: row.avatar_url,
      phone: row.phone,
      joinedAt: row.created_at,
      note: row.note,
      dailyCalorieGoal: row.daily_calorie_goal ?? null,
      proteinPercent: row.protein_percent ?? null,
      carbsPercent: row.carbs_percent ?? null,
      fatPercent: row.fat_percent ?? null,
    };
  } catch {
    return null;
  }
}

/** The trainer sets an athlete's goal for them; null clears it (all four together). */
export async function updateAthleteNutritionGoal(
  athleteId: string,
  goal: {
    dailyCalorieGoal: number | null;
    proteinPercent: number | null;
    carbsPercent: number | null;
    fatPercent: number | null;
  }
): Promise<void> {
  await api.patch(`/athletes/${athleteId}/nutrition-goal`, {
    daily_calorie_goal: goal.dailyCalorieGoal,
    protein_percent: goal.proteinPercent,
    carbs_percent: goal.carbsPercent,
    fat_percent: goal.fatPercent,
  });
}

export async function updateAthleteNote(
  athleteId: string,
  note: string | null
): Promise<void> {
  await api.patch(`/athletes/${athleteId}/note`, { note });
}

interface PendingInviteRow {
  id: string;
  code: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  created_at: string;
  expires_at: string;
  workout_plan_count: number;
  nutrition_plan_count: number;
}

export async function listPendingAthleteInvites(): Promise<PendingAthleteInvite[]> {
  const data = await api.get<ListResponse<PendingInviteRow>>("/athlete-invites");

  return data.items.map((row) => ({
    id: row.id,
    code: row.code,
    name: fullName(row.first_name, row.last_name),
    phone: row.phone,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    workoutPlanCount: row.workout_plan_count,
    nutritionPlanCount: row.nutrition_plan_count,
  }));
}

export async function removeAthlete(athleteId: string): Promise<void> {
  await api.delete(`/athletes/${athleteId}`);
}

export async function revokeAthleteInvite(invitationId: string): Promise<void> {
  await api.post(`/athlete-invites/${invitationId}/revoke`);
}

/**
 * The club the current trainer works at, if any. A trainer can use Gymlic
 * without a club, but when they do belong to one, the athletes they invite
 * become members of that club too — otherwise the club's own member list,
 * plan distribution and "member joined" notification never see them.
 */
export async function getTrainerClub(): Promise<TrainerClub | null> {
  const data = await api.get<{ club: { club_id: string; name: string } | null }>(
    "/trainer/club"
  );
  if (!data.club) return null;

  return { id: data.club.club_id, name: data.club.name };
}

export async function createAthleteInvite(input: {
  firstName: string;
  lastName: string;
  phone: string | null;
  heightCm: number | null;
  weightKg: number | null;
}): Promise<{ code: string }> {
  // The trainer's club is attached server-side, so the invite can create the
  // club membership alongside the trainer/athlete link when it's accepted.
  return api.post<{ code: string }>("/athlete-invites", {
    first_name: input.firstName,
    last_name: input.lastName,
    phone: input.phone,
    height_cm: input.heightCm,
    weight_kg: input.weightKg,
  });
}

export interface PlanEntry {
  id: string;
  title: string;
  description: string | null;
  status: "active" | "completed" | "cancelled" | "draft";
  assignedAt: string;
  // Only ever "structured" for a workout plan built with the day/exercise
  // builder — nutrition plans (and every workout plan written before it
  // existed) are "text", read straight from `description`.
  builderMode: "text" | "structured";
  // Set by the API when a pending invoice locks the plan: for an athlete the
  // content is withheld (description is null) and this says what is owed; for
  // the trainer the content is intact and this only flags the lock.
  locked: boolean;
  invoice: PlanInvoiceSummary | null;
}

interface PlanRow {
  id: string;
  title: string;
  description: string | null;
  status: PlanEntry["status"];
  assigned_at: string;
  builder_mode?: "text" | "structured";
  locked?: boolean;
  invoice?: { id: string; number: string; amount_toman: number };
}

function toPlanEntry(row: PlanRow): PlanEntry {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    assignedAt: row.assigned_at,
    builderMode: row.builder_mode ?? "text",
    locked: row.locked ?? false,
    invoice: row.invoice
      ? { id: row.invoice.id, number: row.invoice.number, amountToman: row.invoice.amount_toman }
      : null,
  };
}

/**
 * Finished plans older than the trainer's plan shows (history_months),
 * left out of the list by the server; null when nothing is limited.
 */
export interface HiddenPlans {
  count: number;
  months: number | null;
}

export async function listPlans(
  kind: PlanKind,
  target: PlanTarget
): Promise<{ items: PlanEntry[]; hidden: HiddenPlans | null }> {
  const params =
    "athleteId" in target
      ? { athlete_id: target.athleteId }
      : { invitation_id: target.invitationId };

  const data = await api.get<ListResponse<PlanRow> & { hidden?: HiddenPlans | null }>(
    `/plans/${kind}${query(params)}`
  );
  return { items: data.items.map(toPlanEntry), hidden: data.hidden ?? null };
}

export async function listMyPlans(kind: PlanKind): Promise<PlanEntry[]> {
  // Drafts are unfinished — the API never returns a plan the trainer hasn't
  // submitted yet.
  const data = await api.get<ListResponse<PlanRow>>(`/plans/${kind}/mine`);
  return data.items.map(toPlanEntry);
}

export async function savePlan(
  kind: PlanKind,
  target: PlanTarget,
  input: {
    id?: string;
    title: string;
    description: string | null;
    status: "active" | "draft";
  }
): Promise<{ id: string }> {
  return api.post<{ id: string }>(`/plans/${kind}`, {
    id: input.id,
    title: input.title,
    description: input.description,
    status: input.status,
    athlete_id: "athleteId" in target ? target.athleteId : null,
    invitation_id: "invitationId" in target ? target.invitationId : null,
  });
}

export async function completePlan(kind: PlanKind, planId: string): Promise<void> {
  await api.post(`/plans/${kind}/${planId}/complete`);
}

export async function listTemplates(kind: PlanKind): Promise<PlanTemplate[]> {
  const data = await api.get<ListResponse<PlanRow>>(`/plans/${kind}/templates`);

  return data.items.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    createdAt: row.assigned_at,
    builderMode: row.builder_mode ?? "text",
  }));
}

// sourceId is the saved plan the template is made from; the server copies its
// days/exercises or meals/foods too. Without it only title/description are kept.
export async function saveTemplate(
  kind: PlanKind,
  input: { title: string; description: string | null; sourceId?: string }
): Promise<{ id: string }> {
  return api.post<{ id: string }>(`/plans/${kind}/templates`, {
    title: input.title,
    description: input.description,
    source_id: input.sourceId,
  });
}

// Creates a new draft plan for the target from a template, structure included.
export async function applyTemplate(
  kind: PlanKind,
  templateId: string,
  target: PlanTarget
): Promise<{
  id: string;
  title: string;
  description: string | null;
  builderMode: "text" | "structured";
}> {
  const data = await api.post<{
    id: string;
    title: string;
    description: string | null;
    builder_mode?: "text" | "structured";
  }>(`/plans/${kind}/templates/${templateId}/apply`, {
    athlete_id: "athleteId" in target ? target.athleteId : undefined,
    invitation_id: "invitationId" in target ? target.invitationId : undefined,
  });

  return {
    id: data.id,
    title: data.title,
    description: data.description,
    builderMode: data.builder_mode ?? "text",
  };
}

export async function deleteTemplate(kind: PlanKind, templateId: string): Promise<void> {
  await api.delete(`/plans/${kind}/templates/${templateId}`);
}
