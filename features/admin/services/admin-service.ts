import { api, query, type ListResponse } from "@/lib/api/client";
import type { ClubStatus } from "@/types/database.types";

export async function setClubStatus(clubId: string, status: ClubStatus) {
  await api.post(`/admin/clubs/${clubId}/status`, { status });
}

export async function setProfileSuspended(userId: string, suspended: boolean) {
  await api.post(`/admin/profiles/${userId}/suspend`, { suspended });
}

export interface AdminProfileEditInput {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
}

/** account_type and is_platform_admin are deliberately not editable here. */
export async function updateProfileAsAdmin(input: AdminProfileEditInput) {
  await api.patch(`/admin/profiles/${input.userId}`, {
    first_name: input.firstName,
    last_name: input.lastName,
    email: input.email,
    phone: input.phone,
    birth_date: input.birthDate,
  });
}

export async function approvePaymentRequest(requestId: string, adminNote?: string) {
  await api.post(`/admin/payment-requests/${requestId}/approve`, {
    admin_note: adminNote || null,
  });
}

export async function rejectPaymentRequest(requestId: string, adminNote?: string) {
  await api.post(`/admin/payment-requests/${requestId}/reject`, {
    admin_note: adminNote || null,
  });
}

export interface PlanInput {
  name: string;
  priceToman: number;
  durationDays: number;
  // null = no cap from this plan (clubs.member_capacity stays unlimited).
  maxMembers?: number | null;
  isActive?: boolean;
}

function toPlanPayload(input: Partial<PlanInput>) {
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.priceToman !== undefined) payload.price_toman = input.priceToman;
  if (input.durationDays !== undefined) payload.duration_days = input.durationDays;
  if (input.maxMembers !== undefined) payload.max_members = input.maxMembers;
  if (input.isActive !== undefined) payload.is_active = input.isActive;
  return payload;
}

export async function createPlan(input: PlanInput) {
  await api.post("/admin/plans", toPlanPayload(input));
}

export async function updatePlan(planId: string, input: Partial<PlanInput>) {
  await api.patch(`/admin/plans/${planId}`, toPlanPayload(input));
}

// ---------------------------------------------------------------------------
// Reads. These were inline Supabase queries in the admin page components; the
// counts and joins they assembled client-side are aggregates now.
// ---------------------------------------------------------------------------

export interface AdminOverview {
  clubs_count: number;
  pending_clubs_count: number;
  trainers_count: number;
  athletes_count: number;
  pending_requests_count: number;
  active_subs: number;
  expiring_subs: number;
  expired_subs: number;
  total_revenue: number;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  return api.get<AdminOverview>("/admin/overview");
}

export interface AdminClubRow {
  id: string;
  name: string;
  status: ClubStatus;
  member_capacity: number | null;
  created_at: string;
  owner_first_name: string | null;
  owner_last_name: string | null;
  owner_phone: string | null;
  owner_email: string | null;
  plan_name: string | null;
  subscription_status: string | null;
  subscription_started_at: string | null;
  subscription_expires_at: string | null;
  member_count: number;
}

export async function listAdminClubs(): Promise<AdminClubRow[]> {
  const data = await api.get<ListResponse<AdminClubRow>>("/admin/clubs");
  return data.items;
}

export interface AdminClubDetail {
  club: AdminClubRow;
  members: {
    role: string;
    joined_at: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  }[];
  payment_requests: {
    id: string;
    amount_toman: number;
    reference_note: string | null;
    status: string;
    admin_note: string | null;
    created_at: string;
    reviewed_at: string | null;
    plan_name: string;
  }[];
}

export async function getAdminClubDetail(clubId: string): Promise<AdminClubDetail | null> {
  try {
    return await api.get<AdminClubDetail>(`/admin/clubs/${clubId}`);
  } catch {
    return null;
  }
}

export interface AdminProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  account_type: string | null;
  birth_date: string | null;
  avatar_url: string | null;
  is_suspended: boolean;
  created_at: string;
  /** Set when listing athletes. */
  trainer_name?: string | null;
  /** Set when listing trainers. */
  athlete_count?: number;
  club_name?: string | null;
}

export async function listAdminProfiles(
  accountType?: "athlete" | "trainer" | "club"
): Promise<AdminProfileRow[]> {
  const data = await api.get<ListResponse<AdminProfileRow>>(
    `/admin/profiles${query({ account_type: accountType })}`
  );
  return data.items;
}

export interface AdminTrainerDetail {
  trainer: AdminProfileRow & { club_name: string | null };
  students: {
    status: string;
    created_at: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  }[];
}

export async function getAdminTrainerDetail(
  trainerId: string
): Promise<AdminTrainerDetail | null> {
  try {
    return await api.get<AdminTrainerDetail>(`/admin/trainers/${trainerId}`);
  } catch {
    return null;
  }
}

export interface AdminPaymentRequestRow {
  id: string;
  club_id: string;
  plan_id: string;
  amount_toman: number;
  reference_note: string | null;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  club_name: string;
  plan_name: string;
}

export async function listPaymentRequests(): Promise<AdminPaymentRequestRow[]> {
  const data = await api.get<ListResponse<AdminPaymentRequestRow>>("/payment-requests");
  return data.items;
}

export interface AdminActivityRow {
  id: string;
  club_id: string | null;
  actor_id: string | null;
  subject_id: string | null;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
  club_name: string | null;
  subject_first_name: string | null;
  subject_last_name: string | null;
}

export async function listAdminActivity(): Promise<AdminActivityRow[]> {
  const data = await api.get<ListResponse<AdminActivityRow>>("/admin/activity");
  return data.items;
}

export interface CatalogPlanRow {
  id: string;
  name: string;
  price_toman: number;
  duration_days: number;
  max_members: number | null;
  is_active: boolean;
}

export async function listCatalogPlans(): Promise<CatalogPlanRow[]> {
  const data = await api.get<ListResponse<CatalogPlanRow>>("/plans-catalog");
  return data.items;
}

export async function listClubOptions(): Promise<{ id: string; name: string }[]> {
  const data = await api.get<ListResponse<{ id: string; name: string }>>(
    "/admin/club-options"
  );
  return data.items;
}
