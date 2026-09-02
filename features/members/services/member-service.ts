import { createClient } from "@/lib/supabase/client";
import type { MembershipStatus } from "@/types/database.types";
import { MEMBER_INVITE_EXPIRES_DAYS } from "../constants/members";
import type {
  ClubCapacity,
  ClubMember,
  ClubTrainerOption,
  CreateMemberInviteInput,
  MemberProfile,
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
      "id, user_id, plan_id, status, joined_at, expires_at, profiles(first_name, last_name, phone, avatar_url), club_membership_plans(name)"
    )
    .eq("club_id", clubId)
    .eq("role", "athlete")
    .order("joined_at", { ascending: false })
    .returns<
      {
        id: string;
        user_id: string;
        plan_id: string | null;
        status: MembershipStatus;
        joined_at: string;
        expires_at: string | null;
        profiles: {
          first_name: string | null;
          last_name: string | null;
          phone: string | null;
          avatar_url: string | null;
        } | null;
        club_membership_plans: { name: string } | null;
      }[]
    >();
  if (error) throw error;

  return (data ?? []).map((row) => ({
    membershipId: row.id,
    userId: row.user_id,
    name: fullName(row.profiles),
    phone: row.profiles?.phone ?? null,
    avatarUrl: row.profiles?.avatar_url ?? null,
    planId: row.plan_id,
    planName: row.club_membership_plans?.name ?? null,
    status: row.status,
    joinedAt: row.joined_at,
    expiresAt: row.expires_at,
  }));
}

export async function listPendingMemberInvites(
  clubId: string
): Promise<PendingMemberInvite[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("invitations")
    .select(
      "id, code, first_name, last_name, phone, plan_id, trainer_id, created_at, expires_at, club_membership_plans(name)"
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
        plan_id: string | null;
        trainer_id: string | null;
        created_at: string;
        expires_at: string;
        club_membership_plans: { name: string } | null;
      }[]
    >();
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    name: fullName(row),
    phone: row.phone,
    planId: row.plan_id,
    planName: row.club_membership_plans?.name ?? null,
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
    plan_id: input.planId,
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
  planId,
  status,
  expiresAt,
}: UpdateMembershipInput): Promise<void> {
  const supabase = createClient();
  const patch: {
    plan_id?: string | null;
    status?: MembershipStatus;
    expires_at?: string | null;
  } = {};
  // undefined means "leave it alone"; null means "no plan" / "no end date".
  if (planId !== undefined) patch.plan_id = planId;
  if (status) patch.status = status;
  if (expiresAt !== undefined) patch.expires_at = expiresAt;
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

/**
 * One member's whole file, as the club may see it: their membership, who
 * trains them, what they have paid this club, the plans assigned to them,
 * their recorded measurements and their class attendance.
 *
 * Each part is scoped to the club and gated by its own RLS policy, so a
 * section coming back empty means "nothing recorded", not "hidden".
 */
export async function getMemberProfile(
  clubId: string,
  membershipId: string
): Promise<MemberProfile | null> {
  const supabase = createClient();

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select(
      "id, user_id, plan_id, status, joined_at, expires_at, profiles(first_name, last_name, phone, avatar_url), club_membership_plans(name)"
    )
    .eq("id", membershipId)
    .eq("club_id", clubId)
    .maybeSingle()
    .returns<{
      id: string;
      user_id: string;
      plan_id: string | null;
      status: MembershipStatus;
      joined_at: string;
      expires_at: string | null;
      profiles: {
        first_name: string | null;
        last_name: string | null;
        phone: string | null;
        avatar_url: string | null;
      } | null;
      club_membership_plans: { name: string } | null;
    } | null>();
  if (membershipError) throw membershipError;
  if (!membership) return null;

  const athleteId = membership.user_id;

  const [trainers, payments, workouts, nutrition, measurements, attendance] =
    await Promise.all([
      supabase
        .from("trainer_athletes")
        .select("trainer_id, profiles!trainer_id(first_name, last_name)")
        .eq("athlete_id", athleteId)
        .eq("club_id", clubId)
        .eq("status", "active")
        .returns<
          {
            trainer_id: string;
            profiles: { first_name: string | null; last_name: string | null } | null;
          }[]
        >(),
      supabase
        .from("revenue_entries")
        .select("id, amount, category, occurred_at, note")
        .eq("club_id", clubId)
        .eq("member_id", athleteId)
        .order("occurred_at", { ascending: false }),
      supabase
        .from("workout_assignments")
        .select("id, title, status, updated_at")
        .eq("athlete_id", athleteId)
        .eq("is_template", false)
        .neq("status", "draft")
        .order("updated_at", { ascending: false })
        .limit(10),
      supabase
        .from("nutrition_assignments")
        .select("id, title, status, updated_at")
        .eq("athlete_id", athleteId)
        .eq("is_template", false)
        .neq("status", "draft")
        .order("updated_at", { ascending: false })
        .limit(10),
      supabase
        .from("measurements")
        .select("id, weight_kg, height_cm, body_fat_percent, recorded_at")
        .eq("athlete_id", athleteId)
        .order("recorded_at", { ascending: false })
        .limit(10),
      supabase
        .from("class_attendance_logs")
        .select("id, attended, class_date")
        .eq("club_id", clubId)
        .eq("member_id", athleteId)
        .order("class_date", { ascending: false })
        .limit(20),
    ]);
  if (trainers.error) throw trainers.error;
  if (payments.error) throw payments.error;
  if (workouts.error) throw workouts.error;
  if (nutrition.error) throw nutrition.error;
  if (measurements.error) throw measurements.error;
  if (attendance.error) throw attendance.error;

  const paymentRows = (payments.data ?? []).map((row) => ({
    id: row.id,
    amount: Number(row.amount),
    category: row.category,
    occurredOn: new Date(row.occurred_at).toISOString().slice(0, 10),
    note: row.note,
  }));

  const attendanceRows = attendance.data ?? [];
  const attended = attendanceRows.filter((row) => row.attended).length;

  return {
    member: {
      membershipId: membership.id,
      userId: membership.user_id,
      name: fullName(membership.profiles),
      phone: membership.profiles?.phone ?? null,
      avatarUrl: membership.profiles?.avatar_url ?? null,
      planId: membership.plan_id,
      planName: membership.club_membership_plans?.name ?? null,
      status: membership.status,
      joinedAt: membership.joined_at,
      expiresAt: membership.expires_at,
    },
    trainers: (trainers.data ?? []).map((row) => ({
      id: row.trainer_id,
      name: fullName(row.profiles),
    })),
    payments: paymentRows,
    totalPaid: paymentRows.reduce((sum, row) => sum + row.amount, 0),
    plans: [
      ...(workouts.data ?? []).map((row) => ({
        id: row.id,
        kind: "workout" as const,
        title: row.title,
        status: row.status,
        updatedAt: row.updated_at,
      })),
      ...(nutrition.data ?? []).map((row) => ({
        id: row.id,
        kind: "nutrition" as const,
        title: row.title,
        status: row.status,
        updatedAt: row.updated_at,
      })),
    ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    measurements: (measurements.data ?? []).map((row) => ({
      id: row.id,
      weightKg: row.weight_kg,
      heightCm: row.height_cm,
      bodyFatPercent: row.body_fat_percent,
      recordedAt: row.recorded_at,
    })),
    attendance: attendanceRows.map((row) => ({
      id: row.id,
      attended: row.attended,
      classDate: row.class_date,
    })),
    attendanceRate:
      attendanceRows.length > 0
        ? Math.round((attended / attendanceRows.length) * 100)
        : null,
  };
}
