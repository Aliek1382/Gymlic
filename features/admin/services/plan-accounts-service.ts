import { api } from "@/lib/api/client";
import type { SubscriptionStatus } from "@/types/database.types";
import type { TrainerLimits } from "@/features/trainer-billing/services/trainer-billing-service";

/** A club's plan as it stands (server: Limits::forClub). */
export interface ClubLimits {
  ready: boolean;
  enforcing: boolean;
  plan_id: string | null;
  plan_name: string | null;
  /** null = the club never had a subscription. */
  status: SubscriptionStatus | null;
  started_at: string | null;
  expires_at: string | null;
  remaining_days: number | null;
  grace_ends_at: string | null;
  max_members: number | null;
  max_trainers: number | null;
  /** An admin's caps are in effect instead of the plan's. */
  override: boolean;
  override_on: boolean;
  override_max_members: number | null;
  override_max_trainers: number | null;
  can_invite: boolean;
  usage: { members: number; pending_member_invites: number; trainers: number; pending_trainer_invites: number };
  over_cap: boolean;
}

export interface TrainerAccount {
  kind: "trainer";
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
  club_name: string | null;
  limits: TrainerLimits;
}

export interface ClubAccount {
  kind: "club";
  id: string;
  name: string;
  club_status: "active" | "suspended" | "pending";
  owner_id: string;
  owner_name: string;
  phone: string | null;
  created_at: string;
  limits: ClubLimits;
}

export type PlanAccount = TrainerAccount | ClubAccount;

export interface AccountPlanOption {
  id: string;
  name: string;
  price_toman: number;
  duration_days: number;
  is_active: boolean;
  is_free?: boolean;
  max_athletes?: number | null;
  max_members?: number | null;
  max_trainers?: number | null;
}

export interface PlanAccountsData {
  /** False until the plan-limits database update has run. */
  ready: boolean;
  enforcing?: boolean;
  grace_days?: number;
  expiring_days?: number;
  trainers: TrainerAccount[];
  clubs: ClubAccount[];
  trainer_plans?: AccountPlanOption[];
  club_plans?: AccountPlanOption[];
}

export async function listPlanAccounts(): Promise<PlanAccountsData> {
  return api.get<PlanAccountsData>("/admin/plan-accounts");
}

export interface HistoryEntry {
  id: string;
  action: string;
  created_at: string;
  actor_first_name: string | null;
  actor_last_name: string | null;
  metadata: Record<string, unknown> | null;
}

export async function getPlanAccount(
  kind: PlanAccount["kind"],
  id: string
): Promise<{ account: PlanAccount; history: HistoryEntry[] }> {
  return api.get(`/admin/plan-accounts/${kind}/${id}`);
}

/** One change by hand; see PlanAccountsController on the server. */
export type PlanAccountChange =
  | { action: "activate"; plan_id: string; started_at?: string; expires_at?: string; amount_toman?: number | null }
  | { action: "dates"; started_at?: string; expires_at: string }
  | { action: "extend"; days: number }
  | { action: "override"; on: boolean; max_athletes?: number | null; max_members?: number | null; max_trainers?: number | null }
  | { action: "reactivate" }
  | { action: "revoke_invites" };

export async function changePlanAccount(
  kind: PlanAccount["kind"],
  id: string,
  change: PlanAccountChange,
  options: { note?: string; notify?: boolean }
): Promise<PlanAccount> {
  const data = await api.post<{ account: PlanAccount }>(`/admin/plan-accounts/${kind}/${id}`, {
    ...change,
    note: options.note || null,
    notify: options.notify ?? true,
  });
  return data.account;
}

/** The change done, measured and rolled back: where the account would stand. */
export async function previewPlanAccount(
  kind: PlanAccount["kind"],
  id: string,
  change: PlanAccountChange
): Promise<{ before: TrainerLimits | ClubLimits; after: TrainerLimits | ClubLimits }> {
  return api.post(`/admin/plan-accounts/${kind}/${id}`, { ...change, preview: true });
}
