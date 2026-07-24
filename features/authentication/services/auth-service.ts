import { createClient } from "@/lib/supabase/client";
import type { AccountType } from "@/types/database.types";

import { normalizeIranPhone } from "../validators/auth-schemas";
import type { LoginMethod } from "../validators/auth-schemas";
import type { Profile } from "../types/auth-types";

export type OtpMethod = Exclude<LoginMethod, "password">;

export async function requestOtp(method: OtpMethod, value: string) {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOtp(
    method === "phone"
      ? { phone: normalizeIranPhone(value) }
      : { email: value.trim() }
  );
  if (error) throw error;
}

export async function verifyOtp(
  method: OtpMethod,
  value: string,
  code: string
) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.verifyOtp(
    method === "phone"
      ? { phone: normalizeIranPhone(value), token: code, type: "sms" }
      : { email: value.trim(), token: code, type: "email" }
  );
  if (error) throw error;
  return data;
}

export async function signInWithPassword(email: string, password: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  return data;
}

export async function signUpWithPassword(
  name: string,
  email: string,
  password: string
): Promise<{ hasSession: boolean }> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
  });
  if (error) throw error;

  // If "Confirm email" is disabled in the Supabase project, signUp already
  // returns a live session — the on_auth_user_created trigger has also
  // already created the profiles row by the time this resolves, so it's
  // safe to update it with the display name right away.
  if (data.session && data.user) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ first_name: name })
      .eq("id", data.user.id);
    if (profileError) throw profileError;
  }

  return { hasSession: !!data.session };
}

export async function getMyProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, phone, email, first_name, last_name, avatar_url, account_type")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    // First login: create the profile row before role selection happens.
    const { data: created, error: insertError } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        phone: user.phone ?? null,
        email: user.email ?? null,
      })
      .select("id, phone, email, first_name, last_name, avatar_url, account_type")
      .single();
    if (insertError) throw insertError;
    return mapProfile(created);
  }

  return mapProfile(data);
}

export async function chooseRole(role: AccountType) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("نشست کاربر معتبر نیست.");

  // Upsert (not a plain update) so this still works even in the unlikely
  // case the profiles row wasn't created yet by the on_auth_user_created
  // trigger — an update would otherwise silently match 0 rows.
  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    account_type: role,
    phone: user.phone ?? null,
    email: user.email ?? null,
  });
  if (error) throw error;
}

export async function createClub(name: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("نشست کاربر معتبر نیست.");

  const { data: club, error } = await supabase
    .from("clubs")
    .insert({ name, owner_id: user.id })
    .select("id")
    .single();
  if (error) throw error;

  const { error: membershipError } = await supabase.from("memberships").insert({
    club_id: club.id,
    user_id: user.id,
    role: "owner",
  });
  if (membershipError) throw membershipError;

  return club.id as string;
}

export async function hasClub(): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { count, error } = await supabase
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "active");
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function hasTrainer(): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { count, error } = await supabase
    .from("trainer_athletes")
    .select("id", { count: "exact", head: true })
    .eq("athlete_id", user.id)
    .eq("status", "active");
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function acceptInvitation(code: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("نشست کاربر معتبر نیست.");

  const { data: invitation, error } = await supabase
    .from("invitations")
    .select("id, club_id, trainer_id, invited_role, status, expires_at")
    .eq("code", code.trim())
    .maybeSingle();
  if (error) throw error;
  if (!invitation) throw new Error("کد دعوت پیدا نشد.");
  if (invitation.status !== "pending")
    throw new Error("این دعوت قبلا استفاده شده یا باطل شده است.");
  if (new Date(invitation.expires_at) < new Date())
    throw new Error("این دعوت منقضی شده است.");

  if (invitation.invited_role === "athlete" && invitation.trainer_id) {
    const { error: relationError } = await supabase
      .from("trainer_athletes")
      .insert({
        trainer_id: invitation.trainer_id,
        athlete_id: user.id,
        club_id: invitation.club_id,
      });
    if (relationError) throw relationError;
  }

  if (invitation.club_id) {
    const { error: membershipError } = await supabase
      .from("memberships")
      .insert({
        club_id: invitation.club_id,
        user_id: user.id,
        role: invitation.invited_role,
      });
    if (membershipError) throw membershipError;
  }

  const { error: updateError } = await supabase
    .from("invitations")
    .update({
      status: "accepted",
      accepted_by: user.id,
      accepted_at: new Date().toISOString(),
    })
    .eq("id", invitation.id);
  if (updateError) throw updateError;
}

export async function signOut() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

function mapProfile(row: {
  id: string;
  phone: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  account_type: AccountType | null;
}): Profile {
  return {
    id: row.id,
    phone: row.phone,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    avatarUrl: row.avatar_url,
    accountType: row.account_type,
  };
}
