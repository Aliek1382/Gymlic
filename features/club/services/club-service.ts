import { createClient } from "@/lib/supabase/client";
import { compressImageToBlob } from "@/lib/image-compression";
import type {
  ClubProfile,
  ClubProfileInput,
  MembershipPlan,
  MembershipPlanInput,
} from "../types/club-types";

const MAX_ORIGINAL_LOGO_BYTES = 8 * 1024 * 1024;

async function getCurrentUserId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("نشست کاربر معتبر نیست.");
  return user.id;
}

export async function getClubProfile(clubId: string): Promise<ClubProfile> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("clubs")
    .select("id, name, logo_url, address, phone, working_hours, member_capacity")
    .eq("id", clubId)
    .single();
  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    logoUrl: data.logo_url,
    address: data.address,
    phone: data.phone,
    workingHours: data.working_hours,
    memberCapacity: data.member_capacity,
  };
}

export async function updateClubProfile(
  clubId: string,
  input: ClubProfileInput
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("clubs")
    .update({
      name: input.name,
      address: input.address,
      phone: input.phone,
      working_hours: input.workingHours,
    })
    .eq("id", clubId)
    .select("id")
    .single();
  if (error) throw error;
}

/**
 * The logo goes into the same public `avatars` bucket as profile pictures,
 * under the owner's own folder — that is exactly what the bucket's write
 * policy allows, so no extra storage rule is needed.
 */
export async function uploadClubLogo(
  clubId: string,
  file: File
): Promise<{ url: string }> {
  const supabase = createClient();
  const ownerId = await getCurrentUserId();

  if (!file.type.startsWith("image/")) {
    throw new Error("فقط فایل تصویری مجاز است.");
  }
  if (file.size > MAX_ORIGINAL_LOGO_BYTES) {
    throw new Error("حجم تصویر انتخابی خیلی زیاد است (حداکثر ۸ مگابایت).");
  }

  const blob = await compressImageToBlob(file, {
    maxDimension: 512,
    initialQuality: 0.9,
  });
  const path = `${ownerId}/club-${clubId}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  // Cache-bust so <img> re-fetches instead of showing the previous logo
  // cached under the same URL.
  const url = `${data.publicUrl}?t=${Date.now()}`;

  const { error: clubError } = await supabase
    .from("clubs")
    .update({ logo_url: url })
    .eq("id", clubId)
    .select("id")
    .single();
  if (clubError) throw clubError;

  return { url };
}

export async function listMembershipPlans(
  clubId: string,
  options?: { activeOnly?: boolean }
): Promise<MembershipPlan[]> {
  const supabase = createClient();

  const [plansResult, membershipsResult] = await Promise.all([
    (options?.activeOnly
      ? supabase
          .from("club_membership_plans")
          .select(
            "id, name, price_toman, duration_days, description, is_active, sort_order"
          )
          .eq("club_id", clubId)
          .eq("is_active", true)
      : supabase
          .from("club_membership_plans")
          .select(
            "id, name, price_toman, duration_days, description, is_active, sort_order"
          )
          .eq("club_id", clubId)
    )
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("memberships")
      .select("plan_id")
      .eq("club_id", clubId)
      .eq("role", "athlete")
      .eq("status", "active"),
  ]);
  if (plansResult.error) throw plansResult.error;
  if (membershipsResult.error) throw membershipsResult.error;

  const counts = new Map<string, number>();
  for (const row of membershipsResult.data ?? []) {
    if (!row.plan_id) continue;
    counts.set(row.plan_id, (counts.get(row.plan_id) ?? 0) + 1);
  }

  return (plansResult.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    priceToman: Number(row.price_toman),
    durationDays: row.duration_days,
    description: row.description,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    memberCount: counts.get(row.id) ?? 0,
  }));
}

export async function createMembershipPlan(
  clubId: string,
  input: MembershipPlanInput
): Promise<{ id: string }> {
  const supabase = createClient();

  // New plans land at the end of the club's list.
  const { data: last, error: lastError } = await supabase
    .from("club_membership_plans")
    .select("sort_order")
    .eq("club_id", clubId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastError) throw lastError;

  const { data, error } = await supabase
    .from("club_membership_plans")
    .insert({
      club_id: clubId,
      name: input.name,
      price_toman: input.priceToman,
      duration_days: input.durationDays,
      description: input.description,
      is_active: input.isActive,
      sort_order: (last?.sort_order ?? -1) + 1,
    })
    .select("id")
    .single();
  if (error) throw error;

  return { id: data.id };
}

export async function updateMembershipPlan(
  planId: string,
  input: MembershipPlanInput
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("club_membership_plans")
    .update({
      name: input.name,
      price_toman: input.priceToman,
      duration_days: input.durationDays,
      description: input.description,
      is_active: input.isActive,
    })
    .eq("id", planId)
    .select("id")
    .single();
  if (error) throw error;
}

/**
 * Members on the plan are not deleted with it — memberships.plan_id is
 * `on delete set null`, so they simply show as having no plan afterwards.
 */
export async function deleteMembershipPlan(planId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("club_membership_plans")
    .delete()
    .eq("id", planId)
    .select("id")
    .single();
  if (error) throw error;
}
