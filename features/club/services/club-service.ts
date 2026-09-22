import { api, type ListResponse } from "@/lib/api/client";
import type {
  ClubProfile,
  ClubProfileInput,
  MembershipPlan,
  MembershipPlanInput,
} from "../types/club-types";

interface ClubRow {
  id: string;
  name: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  working_hours: string | null;
  member_capacity: number | null;
  subscription_plan_name: string | null;
  subscription_status: string | null;
  subscription_expires_at: string | null;
}

export async function getClubRow(clubId: string): Promise<ClubRow> {
  return api.get<ClubRow>(`/clubs/${clubId}`);
}

export async function getClubProfile(clubId: string): Promise<ClubProfile> {
  const row = await getClubRow(clubId);

  return {
    id: row.id,
    name: row.name,
    logoUrl: row.logo_url,
    address: row.address,
    phone: row.phone,
    workingHours: row.working_hours,
    memberCapacity: row.member_capacity,
  };
}

export async function updateClubProfile(
  clubId: string,
  input: ClubProfileInput
): Promise<void> {
  await api.patch(`/clubs/${clubId}`, {
    name: input.name,
    address: input.address,
    phone: input.phone,
    working_hours: input.workingHours,
  });
}

/**
 * The image is validated and resized server-side. The returned URL carries a
 * cache-busting suffix: the new logo overwrites the old one at the same path.
 */
export async function uploadClubLogo(
  clubId: string,
  file: File
): Promise<{ url: string }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("فقط فایل تصویری مجاز است.");
  }

  return api.upload<{ url: string }>(`/clubs/${clubId}/logo`, file);
}

interface MembershipPlanRow {
  id: string;
  name: string;
  price_toman: number;
  duration_days: number;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  member_count: number;
}

export async function listMembershipPlans(
  clubId: string,
  options?: { activeOnly?: boolean }
): Promise<MembershipPlan[]> {
  const data = await api.get<ListResponse<MembershipPlanRow>>(
    `/clubs/${clubId}/membership-plans`
  );

  const rows = options?.activeOnly
    ? data.items.filter((row) => row.is_active)
    : data.items;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    priceToman: row.price_toman,
    durationDays: row.duration_days,
    description: row.description,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    memberCount: row.member_count,
  }));
}

function toPlanPayload(input: Partial<MembershipPlanInput>) {
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.priceToman !== undefined) payload.price_toman = input.priceToman;
  if (input.durationDays !== undefined) payload.duration_days = input.durationDays;
  if (input.description !== undefined) payload.description = input.description;
  if (input.isActive !== undefined) payload.is_active = input.isActive;
  return payload;
}

export async function createMembershipPlan(
  clubId: string,
  input: MembershipPlanInput
): Promise<{ id: string }> {
  return api.post<{ id: string }>(
    `/clubs/${clubId}/membership-plans`,
    toPlanPayload(input)
  );
}

export async function updateMembershipPlan(
  planId: string,
  input: Partial<MembershipPlanInput>
): Promise<void> {
  await api.patch(`/membership-plans/${planId}`, toPlanPayload(input));
}

/** Members already on the plan keep their membership; only the plan goes. */
export async function deleteMembershipPlan(planId: string): Promise<void> {
  await api.delete(`/membership-plans/${planId}`);
}
