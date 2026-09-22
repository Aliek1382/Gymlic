import { createClient } from "@/lib/supabase/client";
import type {
  AccountType,
  ClubStatus,
  InvitationRole,
  MembershipRole,
} from "@/types/database.types";

/**
 * Browser-side twin of the old ServerAuthContext. The app ships as a static
 * export, so there is no request to read cookies from on the server — every
 * gate that used to run in a Server Component now resolves here instead and
 * is cached for the session by React Query.
 */
export interface AuthContext {
  userId: string;
  phone: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  birthDate: string | null;
  accountType: AccountType | null;
  isPlatformAdmin: boolean;
  isSuspended: boolean;
  activeMembership: {
    clubId: string;
    role: MembershipRole;
    clubName: string;
    clubStatus: ClubStatus;
  } | null;
  hasTrainer: boolean;
  trainerName: string | null;
  trainerAvatarUrl: string | null;
}

/**
 * Loads everything the Redirect Rules need to decide where an authenticated
 * user should land. Returns null when there is no session — callers send the
 * visitor to /login in that case.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "phone, email, first_name, last_name, avatar_url, birth_date, account_type, is_platform_admin, is_suspended"
    )
    .eq("id", user.id)
    .maybeSingle();

  const { data: membership } = await supabase
    .from("memberships")
    .select("club_id, role, clubs(name, status)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle()
    .returns<{
      club_id: string;
      role: MembershipRole;
      clubs: { name: string; status: ClubStatus } | null;
    }>();

  const { count: trainerCount } = await supabase
    .from("trainer_athletes")
    .select("id", { count: "exact", head: true })
    .eq("athlete_id", user.id)
    .eq("status", "active");

  let trainerName: string | null = null;
  let trainerAvatarUrl: string | null = null;
  if (profile?.account_type === "athlete") {
    // trainer_athletes has two foreign keys into profiles (trainer_id and
    // athlete_id) — the embed must be disambiguated via the column hint.
    const { data: trainerRelation } = await supabase
      .from("trainer_athletes")
      .select("profiles!trainer_id(first_name, last_name, avatar_url)")
      .eq("athlete_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle()
      .returns<{
        profiles: {
          first_name: string | null;
          last_name: string | null;
          avatar_url: string | null;
        } | null;
      }>();

    trainerName =
      [trainerRelation?.profiles?.first_name, trainerRelation?.profiles?.last_name]
        .filter(Boolean)
        .join(" ") || null;
    trainerAvatarUrl = trainerRelation?.profiles?.avatar_url ?? null;
  }

  return {
    userId: user.id,
    phone: profile?.phone || user.phone || null,
    email: profile?.email || user.email || null,
    firstName: profile?.first_name ?? null,
    lastName: profile?.last_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    birthDate: profile?.birth_date ?? null,
    accountType: (profile?.account_type as AccountType | null) ?? null,
    isPlatformAdmin: profile?.is_platform_admin ?? false,
    isSuspended: profile?.is_suspended ?? false,
    activeMembership: membership
      ? {
          clubId: membership.club_id,
          role: membership.role,
          clubName: membership.clubs?.name ?? "",
          clubStatus: membership.clubs?.status ?? "active",
        }
      : null,
    hasTrainer: (trainerCount ?? 0) > 0,
    trainerName,
    trainerAvatarUrl,
  };
}

export interface AdminContext {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
}

/**
 * Gate for the whole /admin route group. Returns null for anyone without
 * profiles.is_platform_admin set — including a signed-out visitor.
 *
 * On a static host this check is a routing convenience, not the security
 * boundary: /admin's HTML shell is served to anyone who asks for it. What
 * actually protects the data is the admin_* RLS policies, which re-check
 * is_platform_admin on every row the page tries to read or write.
 */
export async function getAdminContext(): Promise<AdminContext | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, avatar_url, is_platform_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_platform_admin) return null;

  return {
    userId: user.id,
    fullName:
      [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
      "مدیر کل",
    avatarUrl: profile.avatar_url,
  };
}

export interface InvitationPreview {
  firstName: string | null;
  lastName: string | null;
  /** Set when the invite was created by a club rather than a lone trainer. */
  clubName: string | null;
  invitedRole: InvitationRole;
}

/**
 * Lookup for the public /join/[code] page. Calls the get_invitation_preview
 * SECURITY DEFINER function, so it works with no session at all — possession
 * of the (unguessable) code is the authorization model.
 */
export async function getInvitationPreview(
  code: string
): Promise<InvitationPreview | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_invitation_preview", {
    p_code: code,
  });
  if (error) return null;

  const row = data?.[0];
  if (!row) return null;

  return {
    firstName: row.first_name,
    lastName: row.last_name,
    clubName: row.club_name,
    invitedRole: row.invited_role,
  };
}
