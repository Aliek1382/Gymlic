import { createClient } from "@/lib/supabase/client";
import type { MembershipPlanTier, MembershipStatus } from "@/types/database.types";
import { MEMBER_INVITE_EXPIRES_DAYS } from "../constants/members";
import type {
  ClubCapacity,
  ClubMember,
  ClubTrainerOption,
  CreateMemberInviteInput,
  PendingMemberInvite,
  UpdateMembershipInput,
} from "../types/member-types";

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

export async function listClubMembers(clubId: string): Promise<ClubMember[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select(
      "id, user_id, plan_tier, status, joined_at, profiles(first_name, last_name, phone, avatar_url)"
    )
    .eq("club_id", clubId)
    .eq("role", "athlete")
    .order("joined_at", { ascending: false })
    .returns<
      {
        id: string;
        user_id: string;
        plan_tier: MembershipPlanTier;
        status: MembershipStatus;
        joined_at: string;
        profiles: {
          first_name: string | null;
          last_name: string | null;
          phone: string | null;
          avatar_url: string | null;
        } | null;
      }[]
    >();
  if (error) throw error;

  return (data ?? []).map((row) => ({
    membershipId: row.id,
    userId: row.user_id,
    name: fullName(row.profiles),
    phone: row.profiles?.phone ?? null,
    avatarUrl: row.profiles?.avatar_url ?? null,
    planTier: row.plan_tier,
    status: row.status,
    joinedAt: row.joined_at,
  }));
}

export async function listPendingMemberInvites(
  clubId: string
): Promise<PendingMemberInvite[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("invitations")
    .select(
      "id, code, first_name, last_name, phone, plan_tier, trainer_id, created_at, expires_at"
    )
    .eq("club_id", clubId)
    .eq("invited_role", "athlete")
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
        plan_tier: MembershipPlanTier | null;
        trainer_id: string | null;
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
    planTier: row.plan_tier ?? "basic",
    trainerId: row.trainer_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }));
}

/** The club's own trainers, offered as an optional coach for a new member. */
export async function listClubTrainers(
  clubId: string
): Promise<ClubTrainerOption[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("user_id, profiles(first_name, last_name)")
    .eq("club_id", clubId)
    .eq("role", "trainer")
    .eq("status", "active")
    .returns<
      {
        user_id: string;
        profiles: { first_name: string | null; last_name: string | null } | null;
      }[]
    >();
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.user_id,
    name: fullName(row.profiles),
  }));
}

/**
 * Active athletes against the cap the club's plan set (clubs.member_capacity;
 * null means the plan puts no cap on it).
 */
export async function getClubCapacity(clubId: string): Promise<ClubCapacity> {
  const supabase = createClient();
  const [countResult, clubResult] = await Promise.all([
    supabase
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .eq("club_id", clubId)
      .eq("role", "athlete")
      .eq("status", "active"),
    supabase.from("clubs").select("member_capacity").eq("id", clubId).single(),
  ]);
  if (countResult.error) throw countResult.error;
  if (clubResult.error) throw clubResult.error;

  return {
    activeMembers: countResult.count ?? 0,
    capacity: clubResult.data?.member_capacity ?? null,
  };
}

export async function createMemberInvite(
  input: CreateMemberInviteInput
): Promise<{ code: string }> {
  const supabase = createClient();
  const ownerId = await getCurrentUserId();

  // Pending invites count against the cap too, otherwise a club could hand
  // out more links than its plan allows and only find out on accept.
  const [capacity, pendingInvites] = await Promise.all([
    getClubCapacity(input.clubId),
    listPendingMemberInvites(input.clubId),
  ]);
  if (
    capacity.capacity !== null &&
    capacity.activeMembers + pendingInvites.length >= capacity.capacity
  ) {
    throw new Error(
      "ظرفیت اعضای پلن فعلی باشگاه تکمیل است. برای افزودن عضو جدید، پلن خود را از بخش امور مالی ارتقا دهید."
    );
  }

  const code = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + MEMBER_INVITE_EXPIRES_DAYS);

  const { error } = await supabase.from("invitations").insert({
    code,
    club_id: input.clubId,
    trainer_id: input.trainerId,
    invited_role: "athlete",
    created_by: ownerId,
    first_name: input.firstName,
    last_name: input.lastName,
    phone: input.phone,
    plan_tier: input.planTier,
    expires_at: expiresAt.toISOString(),
  });
  if (error) throw error;

  return { code };
}

export async function revokeMemberInvite(invitationId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("invitations")
    .update({ status: "revoked" })
    .eq("id", invitationId);
  if (error) throw error;
}

export async function updateMembership({
  membershipId,
  planTier,
  status,
}: UpdateMembershipInput): Promise<void> {
  const supabase = createClient();
  const patch: { plan_tier?: MembershipPlanTier; status?: MembershipStatus } = {};
  if (planTier) patch.plan_tier = planTier;
  if (status) patch.status = status;
  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase
    .from("memberships")
    .update(patch)
    .eq("id", membershipId);
  if (error) throw error;
}

export async function removeMember(membershipId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("memberships")
    .delete()
    .eq("id", membershipId);
  if (error) throw error;
}
