import { api, setToken } from "@/lib/api/client";
import type { AccountType, InvitationRole } from "@/types/database.types";

import type { Profile } from "../types/auth-types";

interface ProfileRow {
  id: string;
  phone: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  birth_date: string | null;
  account_type: AccountType | null;
  is_platform_admin: boolean;
}

interface SessionResponse {
  token: string;
  user: ProfileRow;
}

export async function signInWithPassword(email: string, password: string) {
  const data = await api.post<SessionResponse>("/auth/login", {
    email: email.trim(),
    password,
  });
  setToken(data.token);
  return data;
}

export async function signUpWithPassword(
  name: string,
  email: string,
  password: string
): Promise<{ hasSession: boolean }> {
  const data = await api.post<SessionResponse>("/auth/signup", {
    email: email.trim(),
    password,
    first_name: name,
  });
  setToken(data.token);

  // Signup always returns a live session — there is no email-confirmation
  // step to wait on the way the Supabase project had.
  return { hasSession: true };
}

export async function getMyProfile(): Promise<Profile | null> {
  try {
    const data = await api.get<{ user: ProfileRow }>("/auth/me");
    return mapProfile(data.user);
  } catch {
    return null;
  }
}

export async function chooseRole(role: AccountType) {
  await api.post("/auth/choose-role", { account_type: role });
}

export async function createClub(name: string) {
  const data = await api.post<{ club_id: string }>("/clubs", { name });
  return data.club_id;
}

export async function hasClub(): Promise<boolean> {
  const data = await api.get<{ membership: unknown | null }>("/auth/me");
  return data.membership !== null;
}

export async function hasTrainer(): Promise<boolean> {
  const data = await api.get<{ trainer: unknown | null }>("/auth/me");
  return data.trainer !== null;
}

/**
 * Accepts an invite for the signed-in user from a code they typed in. The
 * code alone doesn't say which kind of invite it is, so the public preview
 * resolves the role first.
 */
export async function acceptInvitation(code: string) {
  const trimmed = code.trim();
  const preview = await getInvitationRole(trimmed);
  if (!preview) throw new Error("کد دعوت پیدا نشد یا منقضی شده است.");

  await acceptInvitationForCurrentUser(trimmed, preview);
}

/**
 * Completes the invitation for the signed-in user. Each endpoint commits the
 * whole hand-off in one transaction rather than several separate calls:
 * role, club membership, trainer link, measurements and any plans
 * pre-assigned to the invitation for an athlete; role, membership and the
 * trainer's existing athletes for a trainer joining a club.
 */
export async function acceptInvitationForCurrentUser(
  code: string,
  invitedRole: InvitationRole
): Promise<void> {
  await api.post(
    invitedRole === "athlete"
      ? "/invitations/accept-athlete"
      : "/invitations/accept-club",
    { code: code.trim() }
  );
}

/**
 * Completes an invite for a brand-new account — an athlete invited by a
 * trainer or a club, or a trainer invited by a club. The invitee only ever
 * provides an email + password here; role, club membership, trainer link,
 * name and measurements all come from the invitation whoever invited them
 * already filled in.
 */
export async function joinViaInvitation(
  code: string,
  email: string,
  password: string
): Promise<{ hasSession: boolean }> {
  const trimmedCode = code.trim();

  const invitedRole = await getInvitationRole(trimmedCode);
  if (!invitedRole) throw new Error("این لینک دعوت معتبر نیست یا منقضی شده است.");

  await api.post<SessionResponse>("/auth/signup", {
    email: email.trim(),
    password,
  }).then((data) => setToken(data.token));

  await acceptInvitationForCurrentUser(trimmedCode, invitedRole);

  return { hasSession: true };
}

export async function signOut() {
  try {
    await api.post("/auth/logout");
  } finally {
    // The local token goes either way: a failed logout call must not leave
    // the browser believing it is still signed in.
    setToken(null);
  }
}

async function getInvitationRole(code: string): Promise<InvitationRole | null> {
  try {
    const preview = await api.get<{ invited_role: InvitationRole }>(
      `/invitations/preview?code=${encodeURIComponent(code)}`
    );
    return preview.invited_role;
  } catch {
    return null;
  }
}

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    phone: row.phone,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    avatarUrl: row.avatar_url,
    birthDate: row.birth_date,
    accountType: row.account_type,
    isPlatformAdmin: row.is_platform_admin,
  };
}
