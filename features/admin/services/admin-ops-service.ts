import { api, query } from "@/lib/api/client";
import type { FeatureCatalogEntry, TierKey, TiersSettings } from "@/features/site-settings/services/site-settings-service";

// --- Error log (/admin/errors) ------------------------------------------------

export type ErrorSource = "server" | "browser";
export type ErrorStatus = "open" | "resolved" | "all";

export interface ErrorLogRow {
  id: string;
  source: ErrorSource;
  message: string;
  /** "src/Controllers/X.php:12" for PHP, "script.js:1:200" for the browser. */
  location: string | null;
  /** Stack trace. */
  detail: string | null;
  /** The API request ("GET /athletes") or the page ("/dashboard/"). */
  url: string | null;
  user_agent: string | null;
  occurrences: number;
  first_seen: string;
  last_seen: string;
  resolved_at: string | null;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
}

export interface ErrorLogList {
  /** False until operations-update.sql has run. */
  ready: boolean;
  items: ErrorLogRow[];
  counts: { open: number; resolved: number; today?: number };
}

export function listErrors(status: ErrorStatus, source: ErrorSource | "") {
  return api.get<ErrorLogList>(`/admin/errors${query({ status, source })}`);
}

export function setErrorResolved(id: string, resolved: boolean) {
  return api.patch<{ ok: true }>(`/admin/errors/${id}`, { resolved });
}

export function resolveAllErrors() {
  return api.post<{ count: number }>("/admin/errors/resolve-all");
}

export function clearResolvedErrors() {
  return api.delete<{ count: number }>("/admin/errors/resolved");
}

// --- Recycle bin (/admin/trash) -----------------------------------------------

export type TrashKind = "user" | "club" | "page" | "discount" | "trainer_discount";

export interface TrashItem {
  id: string;
  kind: TrashKind;
  kind_label: string;
  label: string;
  summary: string | null;
  deleted_at: string;
  /** When it goes for good. */
  purge_at: string;
  deleted_by_name: string | null;
  bytes: number;
}

export interface TrashList {
  ready: boolean;
  retention_days: number;
  items: TrashItem[];
}

export function listTrash() {
  return api.get<TrashList>("/admin/trash");
}

export function restoreTrash(id: string) {
  return api.post<{ kind: TrashKind; label: string; rows: number }>(`/admin/trash/${id}/restore`);
}

export function purgeTrash(id: string) {
  return api.delete<{ ok: true }>(`/admin/trash/${id}`);
}

/** The account and everything only theirs, into the recycle bin. */
export function deleteUser(id: string) {
  return api.delete<{ trash_id: string }>(`/admin/users/${id}`);
}

export function deleteClub(id: string) {
  return api.delete<{ trash_id: string }>(`/admin/clubs/${id}`);
}

// --- Storage (/admin/storage) -------------------------------------------------

export interface StorageFolder {
  folder: string;
  kind: "user" | "system" | "other";
  label: string | null;
  user: { id: string; name: string; email: string | null; account_type: string | null } | null;
  in_trash: boolean;
  /** An account deleted for good: the whole folder is unused. */
  deleted: boolean;
  bytes: number;
  files: number;
}

export interface StorageOrphan {
  path: string;
  bytes: number;
  modified_at: string;
}

export interface StorageOverview {
  total_bytes: number;
  total_files: number;
  folders: StorageFolder[];
  orphans: { count: number; bytes: number; items: StorageOrphan[] };
}

export function getStorage() {
  return api.get<StorageOverview>("/admin/storage");
}

/** paths = the chosen ones; null = every orphan. */
export function cleanStorage(paths: string[] | null) {
  return api.post<{ deleted: number; freed_bytes: number }>("/admin/storage/clean", paths ? { paths } : { all: true });
}

// --- Trainer verification (/admin/verifications) ------------------------------

export type VerificationStatus = "none" | "pending" | "verified" | "rejected";

export interface VerificationRow {
  trainer_id: string;
  certificates: string[];
  verification_status: VerificationStatus;
  verification_note: string | null;
  verification_requested_at: string | null;
  verified_at: string | null;
  verified_by_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  athletes: number;
}

export interface VerificationList {
  ready: boolean;
  items: VerificationRow[];
  counts: Partial<Record<VerificationStatus, number>>;
}

export function listVerifications(status: VerificationStatus | "all") {
  return api.get<VerificationList>(`/admin/verifications${query({ status })}`);
}

export function decideVerification(trainerId: string, decision: "verify" | "reject" | "revoke", note?: string) {
  return api.post<{ status: VerificationStatus }>(`/admin/verifications/${trainerId}`, { decision, note: note ?? null });
}

// --- Weekly email report -------------------------------------------------------

export interface ReportSettings {
  weekly_enabled: boolean;
  recipients: string[];
  /** From this hour (Iran time) on Saturday. */
  send_hour: number;
}

export interface WeeklyReportInfo {
  settings: ReportSettings;
  storage_ready: boolean;
  last_sent: { at: string; date: string; sent: number; failed: { email: string; error: string }[] } | null;
  subject: string;
  /** What the email would say right now. */
  preview: string;
}

export function getWeeklyReport() {
  return api.get<WeeklyReportInfo>("/admin/weekly-report");
}

export async function saveReportSettings(value: ReportSettings): Promise<ReportSettings> {
  const data = await api.put<{ value: ReportSettings }>("/admin/settings/reports", { value });
  return data.value;
}

export function sendWeeklyReportNow() {
  return api.post<{ sent: number; failed: { email: string; error: string }[] }>("/admin/weekly-report/send");
}

// --- Plan tiers (/admin/tiers) ---------------------------------------------------


export interface TierPlanRow {
  id: string;
  name: string;
  price_toman: number;
  duration_days: number;
  max_members?: number | null;
  max_athletes?: number | null;
  is_active: boolean;
  tier: TierKey | null;
}

export interface TiersOverview {
  /** False until tiers-update.sql has run. */
  ready: boolean;
  trainer_ready: boolean;
  storage_ready: boolean;
  tiers: TierKey[];
  config: TiersSettings;
  catalog: FeatureCatalogEntry[];
  club_plans: TierPlanRow[];
  trainer_plans: TierPlanRow[];
  /** Running subscriptions per tier; "" = no tier yet (not limited). */
  running: { clubs: Record<string, number>; trainers: Record<string, number> };
}

export function getTiers() {
  return api.get<TiersOverview>("/admin/tiers");
}

export async function saveTiers(value: TiersSettings): Promise<TiersSettings> {
  const data = await api.put<{ value: TiersSettings }>("/admin/settings/tiers", { value });
  return data.value;
}

export function setPlanTier(kind: "club" | "trainer", planId: string, tier: TierKey | null) {
  return api.put<{ tier: TierKey | null; subscriptions_updated: number }>(`/admin/tiers/plans/${kind}/${planId}`, { tier });
}
