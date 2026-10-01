import { api, ApiError, getApiBaseUrl, getToken, query } from "@/lib/api/client";

export interface CronStatus {
  name: string;
  label: string;
  interval_minutes: number;
  last_run_at: string | null;
  /** Worked out on the server's clock, which may not match the browser's. */
  minutes_ago: number | null;
  summary: string | null;
  /** never = no run recorded yet; stalled = missed several runs. */
  state: "ok" | "stalled" | "never";
}

export interface SystemHealth {
  php: {
    version: string;
    extensions: Record<string, boolean>;
    upload_max_size: string;
    post_max_size: string;
    memory_limit: string;
    max_execution_time: number;
    timezone: string;
    now: string;
  };
  database: {
    version: string;
    now: string;
    tables: number;
    size_bytes: number;
    largest: { name: string; approx_rows: number; size_bytes: number }[];
  };
  uploads: {
    writable: boolean;
    files: number;
    size_bytes: number;
    truncated: boolean;
    free_bytes: number | null;
  };
  crons: CronStatus[];
}

export function getSystemHealth() {
  return api.get<SystemHealth>("/admin/system/health");
}

export interface SystemAlerts {
  pending_migrations: number;
  cron_problems: { label: string; state: "stalled" | "never" }[];
  failed_deliveries: number;
}

export function getSystemAlerts() {
  return api.get<SystemAlerts>("/admin/system/alerts");
}

export interface MigrationRow {
  id: string;
  title: string;
  file: string;
  state: "applied" | "pending";
  /** Set when it was run from this panel (not by hand in phpMyAdmin). */
  ran_at: string | null;
  ran_by_name: string | null;
  file_found: boolean;
  statements: number;
}

export async function listMigrations(): Promise<MigrationRow[]> {
  return (await api.get<{ items: MigrationRow[] }>("/admin/system/migrations")).items;
}

export interface MigrationResult {
  ok: boolean;
  executed: number;
  /** Statements whose change was already in place. */
  skipped: number;
  error: string | null;
  failed_statement: string | null;
}

export function runMigration(id: string) {
  return api.post<MigrationResult>(`/admin/system/migrations/${id}/run`);
}

/**
 * The backup streams as a file, not JSON, so it can't go through api.get:
 * fetched with the session token, then handed to the browser as a download.
 */
export async function downloadBackup(): Promise<void> {
  const token = getToken();
  const response = await fetch(`${getApiBaseUrl()}/admin/system/backup`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(
      payload?.error?.message ?? "دریافت نسخهٔ پشتیبان ناموفق بود.",
      response.status,
      payload?.error?.code ?? "backup_failed"
    );
  }

  const gzip = (response.headers.get("Content-Type") ?? "").includes("gzip");
  const blob = await response.blob();
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `gymlic-backup-${stamp}.sql${gzip ? ".gz" : ""}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export type DeliveryStatus = "pending" | "sent" | "failed";
export type DeliveryChannel = "sms" | "email";

export interface DeliveryRow {
  id: string;
  channel: DeliveryChannel;
  status: DeliveryStatus;
  attempts: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
  title: string;
  recipient_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
}

export interface DeliveryStats {
  channel: DeliveryChannel;
  sent: number;
  failed: number;
  pending: number;
  sent_this_month: number;
}

export interface DeliveriesResponse {
  /** False until notification-channels-update.sql has been run. */
  ready: boolean;
  items: DeliveryRow[];
  /** Last 30 days, per channel. */
  stats: DeliveryStats[];
  max_attempts: number;
}

export function listDeliveries(status: DeliveryStatus | "", channel: DeliveryChannel | "") {
  return api.get<DeliveriesResponse>(`/admin/deliveries${query({ status, channel })}`);
}

export async function retryDelivery(id: string) {
  await api.post(`/admin/deliveries/${id}/retry`);
}

export function retryAllFailedDeliveries() {
  return api.post<{ count: number }>("/admin/deliveries/retry-failed");
}

export async function sendDeliveryNow(id: string) {
  await api.post(`/admin/deliveries/${id}/send`);
}
