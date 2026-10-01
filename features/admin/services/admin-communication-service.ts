import { api, query } from "@/lib/api/client";
import type { AccountType } from "@/types/database.types";

// ---------------------------------------------------------------------------
// Broadcasts
// ---------------------------------------------------------------------------

export type ChannelMode = "off" | "opted" | "all";

export interface BroadcastAudience {
  /** Empty = every account type (and people who haven't picked one yet). */
  roles: AccountType[];
  /** Empty = no club filter; otherwise active members of these clubs. */
  club_ids: string[];
  /** 0 = off; otherwise only people not seen for this many days. */
  inactive_days: number;
}

export interface BroadcastChannels {
  sms: ChannelMode;
  email: ChannelMode;
}

export type BroadcastStatus = "scheduled" | "sending" | "sent" | "cancelled" | "failed";

export interface BroadcastRow {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  audience: BroadcastAudience;
  channels: BroadcastChannels;
  status: BroadcastStatus;
  /** ISO 8601 with offset. */
  scheduled_at: string | null;
  sent_at: string | null;
  recipient_count: number;
  sms_count: number;
  email_count: number;
  error: string | null;
  created_at: string;
  created_by_name: string | null;
}

export interface BroadcastCounts {
  recipients: number;
  sms: number;
  email: number;
}

export interface BroadcastInput {
  title: string;
  body: string;
  link: string;
  audience: BroadcastAudience;
  channels: BroadcastChannels;
  /** "YYYY-MM-DDTHH:MM" in Iran time, or null to send now. */
  scheduled_at: string | null;
}

export function listBroadcasts() {
  return api.get<{ ready: boolean; items: BroadcastRow[] }>("/admin/broadcasts");
}

export function previewBroadcast(audience: BroadcastAudience, channels: BroadcastChannels) {
  return api.post<BroadcastCounts>("/admin/broadcasts/preview", { audience, channels });
}

export function createBroadcast(input: BroadcastInput) {
  return api.post<BroadcastCounts & { status: "sent" | "scheduled"; id?: string }>("/admin/broadcasts", {
    ...input,
    body: input.body.trim() || null,
    link: input.link.trim() || null,
  });
}

export async function cancelBroadcast(id: string) {
  await api.post(`/admin/broadcasts/${id}/cancel`);
}

// ---------------------------------------------------------------------------
// Notification templates
// ---------------------------------------------------------------------------

export interface TemplateCatalogEntry {
  key: string;
  group: string;
  label: string;
  /** Who receives it. */
  to: string;
  title: string;
  body: string;
  vars: Record<string, string>;
}

/** "" title/body = the default text. */
export interface TemplateSetting {
  enabled: boolean;
  title: string;
  body: string;
}

export type TemplateSettings = Record<string, TemplateSetting>;

export async function getTemplates(): Promise<{
  catalog: TemplateCatalogEntry[];
  groups: Record<string, string>;
  settings: TemplateSettings;
  storageReady: boolean;
}> {
  const data = await api.get<{
    settings: { templates?: TemplateSettings };
    template_catalog?: TemplateCatalogEntry[];
    template_groups?: Record<string, string>;
    storage_ready: boolean;
  }>("/admin/settings");
  return {
    catalog: data.template_catalog ?? [],
    groups: data.template_groups ?? {},
    settings: data.settings.templates ?? {},
    storageReady: data.storage_ready,
  };
}

export async function saveTemplates(value: TemplateSettings): Promise<TemplateSettings> {
  const data = await api.put<{ value: TemplateSettings }>("/admin/settings/templates", { value });
  return data.value;
}

// ---------------------------------------------------------------------------
// Support tickets (admin side)
// ---------------------------------------------------------------------------

export type SupportStatus = "open" | "answered" | "closed";
export type SupportCategory = "bug" | "billing" | "account" | "suggestion" | "other";

export interface AdminSupportTicket {
  id: string;
  ticket_number: number;
  category: SupportCategory;
  subject: string;
  status: SupportStatus;
  created_at: string;
  updated_at: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  account_type: AccountType | null;
  message_count?: number;
}

export interface SupportMessage {
  id: string;
  from_admin: boolean;
  body: string;
  created_at: string;
  sender_name: string | null;
}

export function listSupportTickets(status?: SupportStatus) {
  return api.get<{ ready: boolean; items: AdminSupportTicket[]; counts: Record<SupportStatus, number> }>(
    `/admin/support${query({ status })}`
  );
}

export function getSupportTicket(id: string) {
  return api.get<{ ticket: AdminSupportTicket; messages: SupportMessage[] }>(`/admin/support/${id}`);
}

export async function replySupportTicket(id: string, body: string, close: boolean) {
  await api.post(`/admin/support/${id}/messages`, { body, close });
}

export async function setSupportStatus(id: string, status: SupportStatus) {
  await api.patch(`/admin/support/${id}/status`, { status });
}

// ---------------------------------------------------------------------------
// Text pages
// ---------------------------------------------------------------------------

export interface AdminPageRow {
  slug: string;
  title: string;
  body: string;
  is_published: boolean;
  sort_order: number;
  updated_at: string;
  updated_by_name: string | null;
}

export function listAdminPages() {
  return api.get<{ ready: boolean; items: AdminPageRow[] }>("/admin/pages");
}

export function saveAdminPage(
  slug: string,
  input: Pick<AdminPageRow, "title" | "body" | "is_published" | "sort_order">
) {
  return api.put<{ page: AdminPageRow }>(`/admin/pages/${slug}`, input);
}

export async function deleteAdminPage(slug: string) {
  await api.delete(`/admin/pages/${slug}`);
}
