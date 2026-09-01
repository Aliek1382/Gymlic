import { createClient } from "@/lib/supabase/client";
import type { MembershipStatus } from "@/types/database.types";
import { TRAINER_INVITE_EXPIRES_DAYS } from "../constants/trainers";
import type {
  ClubTrainer,
  CreateTrainerInviteInput,
  PendingTrainerInvite,
} from "../types/trainer-types";

function fullName(
  profile: { first_name: string | null; last_name: string | null } | null
): string {
  return (
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    "بدون نام"
  );
}

async function getCurrentUserId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("نشست کاربر معتبر نیست.");
  return user.id;
}

export async function listClubTrainers(clubId: string): Promise<ClubTrainer[]> {
  const supabase = createClient();

  // The athlete counts come from trainer_athletes rows scoped to this club —
  // readable by club managers since migration 0031.
  const [trainersResult, relationsResult] = await Promise.all([
    supabase
      .from("memberships")
      .select(
        "id, user_id, status, joined_at, profiles(first_name, last_name, phone, avatar_url)"
      )
      .eq("club_id", clubId)
      .eq("role", "trainer")
      .order("joined_at", { ascending: false })
      .returns<
        {
          id: string;
          user_id: string;
          status: MembershipStatus;
          joined_at: string;
          profiles: {
            first_name: string | null;
            last_name: string | null;
            phone: string | null;
            avatar_url: string | null;
          } | null;
        }[]
      >(),
    supabase
      .from("trainer_athletes")
      .select("trainer_id")
      .eq("club_id", clubId)
      .eq("status", "active"),
  ]);
  if (trainersResult.error) throw trainersResult.error;
  if (relationsResult.error) throw relationsResult.error;

  const athleteCounts = new Map<string, number>();
  for (const row of relationsResult.data ?? []) {
    athleteCounts.set(row.trainer_id, (athleteCounts.get(row.trainer_id) ?? 0) + 1);
  }

  return (trainersResult.data ?? []).map((row) => ({
    membershipId: row.id,
    userId: row.user_id,
    name: fullName(row.profiles),
    phone: row.profiles?.phone ?? null,
    avatarUrl: row.profiles?.avatar_url ?? null,
    status: row.status,
    joinedAt: row.joined_at,
    athleteCount: athleteCounts.get(row.user_id) ?? 0,
  }));
}

export async function listPendingTrainerInvites(
  clubId: string
): Promise<PendingTrainerInvite[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("invitations")
    .select("id, code, first_name, last_name, phone, created_at, expires_at")
    .eq("club_id", clubId)
    .eq("invited_role", "trainer")
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .returns<
      {
        id: string;
        code: string;
        first_name: string | null;
        last_name: string | null;
        phone: string | null;
        created_at: string;
        expires_at: string;
      }[]
    >();
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    name: fullName(row),
    phone: row.phone,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }));
}

export async function createTrainerInvite(
  input: CreateTrainerInviteInput
): Promise<{ code: string }> {
  const supabase = createClient();
  const ownerId = await getCurrentUserId();

  const code = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TRAINER_INVITE_EXPIRES_DAYS);

  const { error } = await supabase.from("invitations").insert({
    code,
    club_id: input.clubId,
    invited_role: "trainer",
    created_by: ownerId,
    first_name: input.firstName,
    last_name: input.lastName,
    phone: input.phone,
    expires_at: expiresAt.toISOString(),
  });
  if (error) throw error;

  return { code };
}

export async function revokeTrainerInvite(invitationId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("invitations")
    .update({ status: "revoked" })
    .eq("id", invitationId);
  if (error) throw error;
}

export async function updateTrainerStatus(input: {
  membershipId: string;
  status: MembershipStatus;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("memberships")
    .update({ status: input.status })
    .eq("id", input.membershipId);
  if (error) throw error;
}

export async function removeTrainer(membershipId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("memberships")
    .delete()
    .eq("id", membershipId);
  if (error) throw error;
}
