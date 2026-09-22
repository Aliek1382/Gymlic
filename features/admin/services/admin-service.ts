import { api } from "@/lib/api/client";
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
