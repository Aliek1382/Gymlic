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
    }>(`/athletes/${athleteId}`);

    return {
      id: row.id,
      name: fullName(row.first_name, row.last_name),
      birthDate: row.birth_date,
      avatarUrl: row.avatar_url,
      phone: row.phone,
      joinedAt: row.created_at,
      note: row.note,
    };
  } catch {
    return null;
  }
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
}

interface PlanRow {
  id: string;
  title: string;
  description: string | null;
  status: PlanEntry["status"];
  assigned_at: string;
}

function toPlanEntry(row: PlanRow): PlanEntry {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    assignedAt: row.assigned_at,
  };
}

export async function listPlans(
  kind: PlanKind,
  target: PlanTarget
): Promise<PlanEntry[]> {
  const params =
    "athleteId" in target
      ? { athlete_id: target.athleteId }
      : { invitation_id: target.invitationId };

  const data = await api.get<ListResponse<PlanRow>>(`/plans/${kind}${query(params)}`);
  return data.items.map(toPlanEntry);
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
  }));
}

export async function saveTemplate(
  kind: PlanKind,
  input: { title: string; description: string | null }
): Promise<{ id: string }> {
  return api.post<{ id: string }>(`/plans/${kind}/templates`, {
    title: input.title,
    description: input.description,
  });
}

export async function deleteTemplate(kind: PlanKind, templateId: string): Promise<void> {
  await api.delete(`/plans/${kind}/templates/${templateId}`);
}
