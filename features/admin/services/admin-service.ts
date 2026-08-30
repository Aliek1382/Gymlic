import { createClient } from "@/lib/supabase/client";
import type { ClubStatus } from "@/types/database.types";

export async function setClubStatus(clubId: string, status: ClubStatus) {
  const supabase = createClient();
  const { error } = await supabase.rpc("admin_set_club_status", {
    p_club_id: clubId,
    p_status: status,
  });
  if (error) throw error;
}

export async function setProfileSuspended(userId: string, suspended: boolean) {
  const supabase = createClient();
  const { error } = await supabase.rpc("admin_set_profile_suspended", {
    p_user_id: userId,
    p_suspended: suspended,
  });
  if (error) throw error;
}

export interface AdminProfileEditInput {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
}

export async function updateProfileAsAdmin(input: AdminProfileEditInput) {
  const supabase = createClient();
  const { error } = await supabase.rpc("admin_update_profile", {
    p_user_id: input.userId,
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_email: input.email,
    p_phone: input.phone,
    p_birth_date: input.birthDate,
  });
  if (error) throw error;
}

export async function approvePaymentRequest(requestId: string, adminNote?: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("approve_payment_request", {
    p_request_id: requestId,
    p_admin_note: adminNote || null,
  });
  if (error) throw error;
}

export async function rejectPaymentRequest(requestId: string, adminNote?: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("reject_payment_request", {
    p_request_id: requestId,
    p_admin_note: adminNote || null,
  });
  if (error) throw error;
}

export interface PlanInput {
  name: string;
  priceToman: number;
  durationDays: number;
  isActive?: boolean;
}

export async function createPlan(input: PlanInput) {
  const supabase = createClient();
  const { error } = await supabase.from("plans").insert({
    name: input.name,
    price_toman: input.priceToman,
    duration_days: input.durationDays,
    is_active: input.isActive ?? true,
  });
  if (error) throw error;
}

export async function updatePlan(planId: string, input: Partial<PlanInput>) {
  const supabase = createClient();
  const { error } = await supabase
    .from("plans")
    .update({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.priceToman !== undefined && { price_toman: input.priceToman }),
      ...(input.durationDays !== undefined && { duration_days: input.durationDays }),
      ...(input.isActive !== undefined && { is_active: input.isActive }),
    })
    .eq("id", planId);
  if (error) throw error;
}
