import { ApiError, api, fullName } from "@/lib/api/client";
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
export type AdminPermission =
  | "users.view"
  | "users.manage"
  | "finance"
  | "content"
  | "notifications"
  | "support"
  | "settings"
  | "system"
  | "activity";

/**
 * Access to /admin. super = profiles.is_platform_admin (everything); staff =
 * a limited role with only `permissions`. Mirrors backend-php/src/AdminAccess.php,
 * which enforces it on every request — this only decides what to show.
 */
export interface AdminAccess {
  level: "super" | "staff";
  roleName: string | null;
  permissions: AdminPermission[];
}

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
  /** Any kind of admin access, super or staff; null for everyone else. */
  admin: AdminAccess | null;
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

interface MeResponse {
  user: {
    id: string;
    phone: string | null;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    birth_date: string | null;
    account_type: AccountType | null;
    is_platform_admin: boolean;
    is_suspended: boolean;
  };
  membership: {
    club_id: string;
    role: MembershipRole;
    club_name: string;
    club_status: ClubStatus;
  } | null;
  trainer: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
  /** Absent from a backend older than admin roles. */
  admin?: {
    level: "super" | "staff";
    role_name: string | null;
    permissions: AdminPermission[];
  } | null;
}

/**
 * Loads everything the Redirect Rules need to decide where an authenticated
 * user should land. Returns null when there is no session — callers send the
 * visitor to /login in that case.
 *
 * This was four separate queries against Supabase; the API answers it in one.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  let data: MeResponse;
  try {
    data = await api.get<MeResponse>("/auth/me");
  } catch (error) {
    // No connection says nothing about the session, so it must not read as
    // "signed out": throwing keeps the last known context (restored from the
    // offline snapshot) instead of replacing it with null and sending the
    // user to the login page.
    if (error instanceof ApiError && error.status === 0) throw error;
    return null;
  }

  const { user, membership, trainer } = data;

  return {
    userId: user.id,
    phone: user.phone,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    avatarUrl: user.avatar_url,
    birthDate: user.birth_date,
    accountType: user.account_type,
    isPlatformAdmin: user.is_platform_admin,
    admin: data.admin
      ? { level: data.admin.level, roleName: data.admin.role_name, permissions: data.admin.permissions }
      : user.is_platform_admin
        ? { level: "super", roleName: null, permissions: ALL_PERMISSIONS }
        : null,
    isSuspended: user.is_suspended,
    activeMembership: membership
      ? {
          clubId: membership.club_id,
          role: membership.role,
          clubName: membership.club_name ?? "",
          clubStatus: membership.club_status ?? "active",
        }
      : null,
    hasTrainer: trainer !== null,
    trainerName: trainer ? fullName(trainer.first_name, trainer.last_name, "") || null : null,
    trainerAvatarUrl: trainer?.avatar_url ?? null,
  };
}

export const ALL_PERMISSIONS: AdminPermission[] = [
  "users.view",
  "users.manage",
  "finance",
  "content",
  "notifications",
  "support",
  "settings",
  "system",
  "activity",
];

export interface AdminContext {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  access: AdminAccess;
}

/**
 * Gate for the whole /admin route group. Returns null for anyone without
 * admin access (super or a staff role) — including a signed-out visitor.
 *
 * On a static host this check is a routing convenience, not the security
 * boundary: /admin's HTML shell is served to anyone who asks for it. What
 * actually protects the data is the API, which re-checks is_platform_admin
 * on every admin endpoint.
 */
export async function getAdminContext(): Promise<AdminContext | null> {
  const context = await getAuthContext();
  if (!context?.admin) return null;

  return {
    userId: context.userId,
    fullName: fullName(context.firstName, context.lastName, "مدیر"),
    avatarUrl: context.avatarUrl,
    access: context.admin,
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
 * Lookup for the public /join/[code] page. The endpoint takes no session —
 * possession of the (unguessable) code is the authorization model.
 */
export async function getInvitationPreview(
  code: string
): Promise<InvitationPreview | null> {
  try {
    const row = await api.get<{
      first_name: string | null;
      last_name: string | null;
      club_name: string | null;
      invited_role: InvitationRole;
    }>(`/invitations/preview?code=${encodeURIComponent(code)}`);

    return {
      firstName: row.first_name,
      lastName: row.last_name,
      clubName: row.club_name,
      invitedRole: row.invited_role,
    };
  } catch {
    return null;
  }
}
