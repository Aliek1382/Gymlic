import { createClient } from "@/lib/supabase/client";
import { INVITE_EXPIRES_DAYS } from "../constants/athletes";
import type {
  AthleteSummary,
  PendingAthleteInvite,
  PlanKind,
  PlanTarget,
  PlanTemplate,
} from "../types/athlete-types";

async function getCurrentUserId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("نشست کاربر معتبر نیست.");
  return user.id;
}

// Tallies rows by whichever id column is present — athlete_id for joined
// athletes, invitation_id for plans pre-assigned to a pending invite.
function countRowsById(rows: { id: string | null }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.id) continue;
    counts.set(row.id, (counts.get(row.id) ?? 0) + 1);
  }
  return counts;
}

export async function listAthletes(): Promise<AthleteSummary[]> {
  const supabase = createClient();
  const trainerId = await getCurrentUserId();

  // trainer_athletes has two foreign keys into profiles (trainer_id and
  // athlete_id) — the embed must be disambiguated via the column-based
  // hint, or PostgREST rejects the query as ambiguous.
  const [athletesResult, workouts, nutrition] = await Promise.all([
    supabase
      .from("trainer_athletes")
      .select("athlete_id, created_at, profiles!athlete_id(first_name, last_name)")
      .eq("trainer_id", trainerId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .returns<
        {
          athlete_id: string;
          created_at: string;
          profiles: { first_name: string | null; last_name: string | null } | null;
        }[]
      >(),
    // Counted for the "most/fewest plans" sort options — drafts don't
    // count (never sent to the athlete) and templates never carry an
    // athlete_id to begin with.
    supabase
      .from("workout_assignments")
      .select("id:athlete_id")
      .eq("trainer_id", trainerId)
      .eq("is_template", false)
      .neq("status", "draft"),
    supabase
      .from("nutrition_assignments")
      .select("id:athlete_id")
      .eq("trainer_id", trainerId)
      .eq("is_template", false)
      .neq("status", "draft"),
  ]);
  if (athletesResult.error) throw athletesResult.error;
  if (workouts.error) throw workouts.error;
  if (nutrition.error) throw nutrition.error;

  const workoutCounts = countRowsById(workouts.data ?? []);
  const nutritionCounts = countRowsById(nutrition.data ?? []);

  return (athletesResult.data ?? []).map((row) => ({
    id: row.athlete_id,
    name:
      [row.profiles?.first_name, row.profiles?.last_name]
        .filter(Boolean)
        .join(" ") || "بدون نام",
    joinedAt: row.created_at,
    workoutPlanCount: workoutCounts.get(row.athlete_id) ?? 0,
    nutritionPlanCount: nutritionCounts.get(row.athlete_id) ?? 0,
  }));
}

export async function listPendingAthleteInvites(): Promise<
  PendingAthleteInvite[]
> {
  const supabase = createClient();
  const trainerId = await getCurrentUserId();

  const [invitesResult, workouts, nutrition] = await Promise.all([
    supabase
      .from("invitations")
      .select("id, code, first_name, last_name, height_cm, weight_kg, created_at, expires_at")
      .eq("created_by", trainerId)
      .eq("invited_role", "athlete")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    // A trainer can pre-assign plans to a pending invite before the athlete
    // even joins, so these can be counted the same way as listAthletes().
    supabase
      .from("workout_assignments")
      .select("id:invitation_id")
      .eq("trainer_id", trainerId)
      .eq("is_template", false)
      .neq("status", "draft"),
    supabase
      .from("nutrition_assignments")
      .select("id:invitation_id")
      .eq("trainer_id", trainerId)
      .eq("is_template", false)
      .neq("status", "draft"),
  ]);
  if (invitesResult.error) throw invitesResult.error;
  if (workouts.error) throw workouts.error;
  if (nutrition.error) throw nutrition.error;

  const workoutCounts = countRowsById(workouts.data ?? []);
  const nutritionCounts = countRowsById(nutrition.data ?? []);

  return (invitesResult.data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    name:
      [row.first_name, row.last_name].filter(Boolean).join(" ") || "بدون نام",
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    workoutPlanCount: workoutCounts.get(row.id) ?? 0,
    nutritionPlanCount: nutritionCounts.get(row.id) ?? 0,
  }));
}

export async function removeAthlete(athleteId: string): Promise<void> {
  const supabase = createClient();
  const trainerId = await getCurrentUserId();

  const { error } = await supabase
    .from("trainer_athletes")
    .delete()
    .eq("trainer_id", trainerId)
    .eq("athlete_id", athleteId);
  if (error) throw error;
}

export async function revokeAthleteInvite(invitationId: string): Promise<void> {
  const supabase = createClient();
  const trainerId = await getCurrentUserId();

  const { error } = await supabase
    .from("invitations")
    .update({ status: "revoked" })
    .eq("id", invitationId)
    .eq("created_by", trainerId);
  if (error) throw error;
}

export async function createAthleteInvite(input: {
  firstName: string;
  lastName: string;
  heightCm: number | null;
  weightKg: number | null;
}): Promise<{ code: string }> {
  const supabase = createClient();
  const trainerId = await getCurrentUserId();

  const code = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRES_DAYS);

  const { error } = await supabase.from("invitations").insert({
    code,
    trainer_id: trainerId,
    invited_role: "athlete",
    created_by: trainerId,
    first_name: input.firstName,
    last_name: input.lastName,
    height_cm: input.heightCm,
    weight_kg: input.weightKg,
    expires_at: expiresAt.toISOString(),
  });
  if (error) throw error;

  return { code };
}

const TABLE_BY_KIND = {
  workout: "workout_assignments",
  nutrition: "nutrition_assignments",
} as const;

const COMPLETE_RPC_BY_KIND = {
  workout: "complete_workout_assignment",
  nutrition: "complete_nutrition_assignment",
} as const;

export interface PlanEntry {
  id: string;
  title: string;
  description: string | null;
  status: "active" | "completed" | "cancelled" | "draft";
  assignedAt: string;
}

export async function listPlans(
  kind: PlanKind,
  target: PlanTarget
): Promise<PlanEntry[]> {
  const supabase = createClient();
  const trainerId = await getCurrentUserId();

  let query = supabase
    .from(TABLE_BY_KIND[kind])
    .select("id, title, description, status, assigned_at")
    .eq("trainer_id", trainerId);
  query =
    "athleteId" in target
      ? query.eq("athlete_id", target.athleteId)
      : query.eq("invitation_id", target.invitationId);

  const { data, error } = await query.order("assigned_at", {
    ascending: false,
  });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    assignedAt: row.assigned_at,
  }));
}

export async function listMyPlans(kind: PlanKind): Promise<PlanEntry[]> {
  const supabase = createClient();
  const athleteId = await getCurrentUserId();

  // Drafts are unfinished — an athlete should never see a plan their
  // trainer hasn't submitted yet.
  const { data, error } = await supabase
    .from(TABLE_BY_KIND[kind])
    .select("id, title, description, status, assigned_at")
    .eq("athlete_id", athleteId)
    .neq("status", "draft")
    .order("assigned_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    assignedAt: row.assigned_at,
  }));
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
  const supabase = createClient();
  const trainerId = await getCurrentUserId();

  if (input.id) {
    const { error } = await supabase
      .from(TABLE_BY_KIND[kind])
      .update({
        title: input.title,
        description: input.description,
        status: input.status,
      })
      .eq("id", input.id)
      .eq("trainer_id", trainerId);
    if (error) throw error;
    return { id: input.id };
  }

  const { data, error } = await supabase
    .from(TABLE_BY_KIND[kind])
    .insert({
      trainer_id: trainerId,
      athlete_id: "athleteId" in target ? target.athleteId : null,
      invitation_id: "invitationId" in target ? target.invitationId : null,
      title: input.title,
      description: input.description,
      status: input.status,
    })
    .select("id")
    .single();
  if (error) throw error;

  return { id: data.id };
}

export async function completePlan(kind: PlanKind, planId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc(COMPLETE_RPC_BY_KIND[kind], {
    p_id: planId,
  });
  if (error) throw error;
}

export async function listTemplates(kind: PlanKind): Promise<PlanTemplate[]> {
  const supabase = createClient();
  const trainerId = await getCurrentUserId();

  const { data, error } = await supabase
    .from(TABLE_BY_KIND[kind])
    .select("id, title, description, assigned_at")
    .eq("trainer_id", trainerId)
    .eq("is_template", true)
    .order("assigned_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => ({
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
  const supabase = createClient();
  const trainerId = await getCurrentUserId();

  const { data, error } = await supabase
    .from(TABLE_BY_KIND[kind])
    .insert({
      trainer_id: trainerId,
      title: input.title,
      description: input.description,
      is_template: true,
    })
    .select("id")
    .single();
  if (error) throw error;

  return { id: data.id };
}

export async function deleteTemplate(kind: PlanKind, templateId: string): Promise<void> {
  const supabase = createClient();
  const trainerId = await getCurrentUserId();

  const { error } = await supabase
    .from(TABLE_BY_KIND[kind])
    .delete()
    .eq("id", templateId)
    .eq("trainer_id", trainerId)
    .eq("is_template", true);
  if (error) throw error;
}
