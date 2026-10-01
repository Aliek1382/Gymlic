import { api, query } from "@/lib/api/client";
import type { AccountType } from "@/types/database.types";

export type UserFilter = "" | AccountType | "none" | "admin" | "suspended";

export interface AdminUserRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  account_type: AccountType | null;
  avatar_url: string | null;
  is_suspended: boolean;
  is_platform_admin: boolean;
  /** A limited admin role, if the account has one (null before the phase-5 update). */
  admin_role_id: string | null;
  admin_role_name: string | null;
  /** Devices currently signed in. */
  session_count: number;
  created_at: string;
  /** Newest live session; sessions are deleted on logout, so approximate. */
  last_login_at: string | null;
  /** Clubs owned, memberships and trainer–athlete links. The role only changes at 0. */
  link_count: number;
}

export async function listAdminUsers(filter: UserFilter, q: string): Promise<AdminUserRow[]> {
  const data = await api.get<{ items: AdminUserRow[] }>(`/admin/users${query({ filter, q })}`);
  return data.items;
}

export async function setUserRole(userId: string, role: AccountType | null) {
  await api.patch(`/admin/users/${userId}/role`, { account_type: role });
}

export type AdminLevel = "none" | "super" | "role";

export async function setUserAdminLevel(userId: string, level: AdminLevel, roleId?: string) {
  await api.post(`/admin/users/${userId}/admin`, { level, role_id: roleId ?? null });
}

export interface UserSession {
  /** A hash prefix, not the token. */
  id: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
  expires_at: string;
  /** The session this very page is using. */
  is_current: boolean;
}

export async function listUserSessions(userId: string): Promise<UserSession[]> {
  return (await api.get<{ items: UserSession[] }>(`/admin/users/${userId}/sessions`)).items;
}

/** One device, or — without sessionId — every device. */
export function revokeUserSessions(userId: string, sessionId?: string) {
  return api.delete<{ count: number }>(
    `/admin/users/${userId}/sessions${sessionId ? `/${sessionId}` : ""}`
  );
}

export async function setUserPassword(userId: string, password: string) {
  await api.post(`/admin/users/${userId}/password`, { password });
}

export type BulkAction = "suspend" | "unsuspend" | "role";

export interface BulkResult {
  done: number;
  /** The accounts left as they were, and why. */
  skipped: { id: string; name: string; reason: string }[];
}

/** One action on many accounts; each goes through the same rules as its single action. */
export function bulkUserAction(action: BulkAction, ids: string[], role?: AccountType | null) {
  return api.post<BulkResult>("/admin/users/bulk", { action, ids, role: role ?? null });
}
