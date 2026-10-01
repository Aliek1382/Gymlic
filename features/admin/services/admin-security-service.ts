import { api } from "@/lib/api/client";
import type { AdminPermission } from "@/features/authentication/services/auth-context-service";

// ---- Roles ------------------------------------------------------------------

export interface PermissionInfo {
  key: AdminPermission;
  label: string;
  description: string;
}

export interface AdminRoleRow {
  id: string;
  name: string;
  permissions: AdminPermission[];
  members: { id: string; name: string }[];
}

export interface AdminRolesResponse {
  /** False until the phase-5 database update has run. */
  ready: boolean;
  catalog: PermissionInfo[];
  roles: AdminRoleRow[];
}

export function listAdminRoles() {
  return api.get<AdminRolesResponse>("/admin/roles");
}

export async function createAdminRole(name: string, permissions: AdminPermission[]) {
  await api.post("/admin/roles", { name, permissions });
}

export async function updateAdminRole(id: string, name: string, permissions: AdminPermission[]) {
  await api.patch(`/admin/roles/${id}`, { name, permissions });
}

export async function deleteAdminRole(id: string) {
  await api.delete(`/admin/roles/${id}`);
}

// ---- Login security -----------------------------------------------------------

export interface SecurityPolicy {
  max_attempts: number;
  lock_minutes: number;
  ip_max_attempts: number;
  admin_2fa: boolean;
}

export interface SecurityOverview {
  /** False until the phase-5 database update has run. */
  ready: boolean;
  settings: SecurityPolicy;
  sms_ready: boolean;
  admins_without_phone: { id: string; name: string }[];
  my_phone_hint: string;
  locked: {
    emails: { email: string; failures: number; minutes_left: number }[];
    ips: { ip: string; failures: number; minutes_left: number }[];
  };
  recent_failures: { email: string; ip_address: string | null; created_at: string }[];
  code_ttl_minutes: number;
}

export function getSecurityOverview() {
  return api.get<SecurityOverview>("/admin/security");
}

/** Lockout numbers, or switching two-step login off (on goes through start/confirm). */
export async function saveSecurityPolicy(policy: SecurityPolicy) {
  await api.put("/admin/settings/security", { value: policy });
}

export function startTwoFactorSetup() {
  return api.post<{ challenge_id: string; phone_hint: string }>("/admin/security/2fa/start");
}

export async function confirmTwoFactorSetup(challengeId: string, code: string) {
  await api.post("/admin/security/2fa/confirm", { challenge_id: challengeId, code: code.trim() });
}

export function unlockLogin(target: { email: string } | { ip: string }) {
  return api.post<{ cleared: number }>("/admin/security/unlock", target);
}
