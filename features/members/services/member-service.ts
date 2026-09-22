import { api, fullName, type ListResponse } from "@/lib/api/client";
import type { MembershipStatus, RevenueCategory } from "@/types/database.types";
import type {
  ClubCapacity,
  ClubMember,
  ClubTrainerOption,
  CreateMemberInviteInput,
  MemberProfile,
  PendingMemberInvite,
  UpdateMembershipInput,
} from "../types/member-types";

interface MemberRow {
  id: string;
  user_id: string;
  plan_id: string | null;
  status: MembershipStatus;
  joined_at: string;
  expires_at: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  plan_name: string | null;
}

function toClubMember(row: MemberRow): ClubMember {
  return {
    membershipId: row.id,
    userId: row.user_id,
    name: fullName(row.first_name, row.last_name),
    phone: row.phone,
    avatarUrl: row.avatar_url,
    planId: row.plan_id,
    planName: row.plan_name,
    status: row.status,
    joinedAt: row.joined_at,
    expiresAt: row.expires_at,
  };
}

export async function listClubMembers(clubId: string): Promise<ClubMember[]> {
  const data = await api.get<ListResponse<MemberRow>>(`/clubs/${clubId}/members`);
  return data.items.map(toClubMember);
}

interface PendingInviteRow {
  id: string;
  code: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  plan_id: string | null;
  plan_name: string | null;
  trainer_id: string | null;
  created_at: string;
  expires_at: string;
}

export async function listPendingMemberInvites(
  clubId: string
): Promise<PendingMemberInvite[]> {
  const data = await api.get<ListResponse<PendingInviteRow>>(
    `/clubs/${clubId}/member-invites`
  );

  return data.items.map((row) => ({
    id: row.id,
    code: row.code,
    name: fullName(row.first_name, row.last_name),
    phone: row.phone,
    planId: row.plan_id,
    planName: row.plan_name,
    trainerId: row.trainer_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }));
}

/** The club's own trainers, offered as an optional coach for a new member. */
export async function listClubTrainers(clubId: string): Promise<ClubTrainerOption[]> {
  const data = await api.get<
    ListResponse<{ id: string; first_name: string | null; last_name: string | null }>
  >(`/clubs/${clubId}/trainer-options`);

  return data.items.map((row) => ({
    id: row.id,
    name: fullName(row.first_name, row.last_name),
  }));
}

/**
 * Active athletes against the cap the club's plan set (null means the plan
 * puts no cap on it).
 */
export async function getClubCapacity(clubId: string): Promise<ClubCapacity> {
  const data = await api.get<{ active_members: number; capacity: number | null }>(
    `/clubs/${clubId}/capacity`
  );

  return { activeMembers: data.active_members, capacity: data.capacity };
}

/**
 * The capacity check runs server-side inside the same transaction as the
 * insert — the browser used to read the count and insert separately, so two
 * managers could each pass the check and overshoot the plan's limit.
 */
export async function createMemberInvite(
  input: CreateMemberInviteInput
): Promise<{ code: string }> {
  return api.post<{ code: string }>(`/clubs/${input.clubId}/member-invites`, {
    first_name: input.firstName,
    last_name: input.lastName,
    phone: input.phone,
    plan_id: input.planId,
    trainer_id: input.trainerId,
  });
}

export async function revokeMemberInvite(invitationId: string): Promise<void> {
  await api.post(`/invitations/${invitationId}/revoke`);
}

export async function updateMembership({
  membershipId,
  planId,
  status,
  expiresAt,
}: UpdateMembershipInput): Promise<void> {
  const patch: Record<string, unknown> = {};
  // undefined means "leave it alone"; null means "no plan" / "no end date".
  if (planId !== undefined) patch.plan_id = planId;
  if (status) patch.status = status;
  if (expiresAt !== undefined) patch.expires_at = expiresAt;
  if (Object.keys(patch).length === 0) return;

  await api.patch(`/memberships/${membershipId}`, patch);
}

export async function removeMember(membershipId: string): Promise<void> {
  await api.delete(`/memberships/${membershipId}`);
}

interface MemberProfileResponse {
  member: MemberRow;
  trainers: { id: string; first_name: string | null; last_name: string | null }[];
  payments: {
    id: string;
    amount: number;
    category: RevenueCategory;
    occurred_at: string;
    note: string | null;
  }[];
  total_paid: number;
  plans: {
    id: string;
    kind: "workout" | "nutrition";
    title: string;
    status: string;
    updated_at: string;
  }[];
  measurements: {
    id: string;
    weight_kg: number | null;
    height_cm: number | null;
    body_fat_percent: number | null;
    recorded_at: string;
  }[];
  attendance: { id: string; attended: boolean; class_date: string }[];
  attendance_rate: number | null;
}

/**
 * One member's whole file, as the club may see it: their membership, who
 * trains them, what they have paid this club, the plans assigned to them,
 * their recorded measurements and their class attendance — in one request.
 */
export async function getMemberProfile(
  clubId: string,
  membershipId: string
): Promise<MemberProfile | null> {
  let data: MemberProfileResponse;
  try {
    data = await api.get<MemberProfileResponse>(
      `/clubs/${clubId}/members/${membershipId}/profile`
    );
  } catch {
    return null;
  }

  return {
    member: toClubMember(data.member),
    trainers: data.trainers.map((row) => ({
      id: row.id,
      name: fullName(row.first_name, row.last_name),
    })),
    payments: data.payments.map((row) => ({
      id: row.id,
      amount: row.amount,
      category: row.category,
      occurredOn: row.occurred_at,
      note: row.note,
    })),
    totalPaid: data.total_paid,
    plans: data.plans.map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      status: row.status,
      updatedAt: row.updated_at,
    })),
    measurements: data.measurements.map((row) => ({
      id: row.id,
      weightKg: row.weight_kg,
      heightCm: row.height_cm,
      bodyFatPercent: row.body_fat_percent,
      recordedAt: row.recorded_at,
    })),
    attendance: data.attendance.map((row) => ({
      id: row.id,
      attended: row.attended,
      classDate: row.class_date,
    })),
    attendanceRate: data.attendance_rate,
  };
}
