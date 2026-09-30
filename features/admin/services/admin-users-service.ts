import { api, query } from "@/lib/api/client";
import type { AccountType } from "@/types/database.types";

export type UserFilter = "" | AccountType | "none" | "admin" | "suspended";

export interface AdminUserRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  account_type: AccountType | null;
  avatar_url: string | null;
  is_suspended: boolean;
  is_platform_admin: boolean;
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

export async function setUserAdmin(userId: string, isAdmin: boolean) {
  await api.post(`/admin/users/${userId}/admin`, { is_admin: isAdmin });
}

export async function setUserPassword(userId: string, password: string) {
  await api.post(`/admin/users/${userId}/password`, { password });
}
