import { api } from "@/lib/api/client";
import type { AccountType } from "@/types/database.types";
import type { FeatureKey } from "../constants";

export type RoleSwitches = Record<AccountType, boolean>;

export interface FeatureState {
  enabled: boolean;
  /** Only the account types that use the section appear here. */
  roles: Partial<RoleSwitches>;
}

export type AnnouncementTone = "info" | "warning" | "success";

export interface MaintenanceSettings {
  enabled: boolean;
  message: string;
}

export interface SignupSettings {
  open: boolean;
  roles: RoleSwitches;
}

export interface AnnouncementSettings {
  enabled: boolean;
  message: string;
  tone: AnnouncementTone;
  roles: RoleSwitches;
}

export interface SupportSettings {
  phone: string;
  email: string;
  telegram: string;
  whatsapp: string;
  hours: string;
}

export type FeatureSettings = Partial<Record<FeatureKey, FeatureState>>;

export type AttachmentType = "voice" | "image" | "video" | "file";

export interface LimitsSettings {
  /** Never above 1000: messages.body is VARCHAR(1000). */
  message_max_chars: number;
  attachments: Record<AttachmentType, boolean>;
  upload_mb: Record<AttachmentType, number>;
}

/** Empty fields = Gymlic's own name, color and mark. */
export interface BrandingSettings {
  app_name: string;
  /** "#rrggbb" */
  primary_color: string;
  /** Set only through the logo upload (uploadBrandLogo). */
  logo_url: string;
}

export type TierKey = "free" | "silver" | "gold" | "diamond";

export const TIER_KEYS: TierKey[] = ["free", "silver", "gold", "diamond"];

export interface TierConfig {
  label: string;
  /** false = this tier doesn't open the section; missing = it does. */
  features: Partial<Record<FeatureKey, boolean>>;
}

/** What each plan tier opens (backend Tiers); everything until the admin says otherwise. */
export type TiersSettings = Record<TierKey, TierConfig> & {
  free_limits: { max_athletes: number | null; max_members: number | null };
};

export interface SiteSettings {
  maintenance: MaintenanceSettings;
  signup: SignupSettings;
  announcement: AnnouncementSettings;
  support: SupportSettings;
  features: FeatureSettings;
  limits: LimitsSettings;
  branding: BrandingSettings;
  tiers: TiersSettings;
}

export type SiteSettingKey = keyof SiteSettings;

const ALL_ROLES: RoleSwitches = { club: true, trainer: true, athlete: true };

/** What the site does with nothing configured — and what it falls back to. */
export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  maintenance: { enabled: false, message: "" },
  signup: { open: true, roles: ALL_ROLES },
  announcement: { enabled: false, message: "", tone: "info", roles: ALL_ROLES },
  support: { phone: "", email: "", telegram: "", whatsapp: "", hours: "" },
  features: {},
  limits: {
    message_max_chars: 1000,
    attachments: { voice: true, image: true, video: true, file: true },
    upload_mb: { voice: 8, image: 8, video: 50, file: 8 },
  },
  branding: { app_name: "", primary_color: "", logo_url: "" },
  tiers: {
    free: { label: "رایگان", features: {} },
    silver: { label: "نقره‌ای", features: {} },
    gold: { label: "طلایی", features: {} },
    diamond: { label: "الماسی", features: {} },
    free_limits: { max_athletes: null, max_members: null },
  },
};

/**
 * A group missing from the answer (a backend older than that group, or a null)
 * keeps its defaults, and a partial group is filled in field by field —
 * components destructure these groups, and one undefined takes the page down.
 */
export function withDefaults(data: Partial<SiteSettings> | null | undefined): SiteSettings {
  const out: Record<string, unknown> = { ...DEFAULT_SITE_SETTINGS };
  for (const [key, value] of Object.entries(data ?? {})) {
    if (value === null || value === undefined) continue;
    const base = out[key];
    out[key] =
      base && typeof base === "object" && typeof value === "object" && !Array.isArray(value)
        ? { ...base, ...value }
        : value;
  }
  return out as unknown as SiteSettings;
}

/**
 * Never throws: if the endpoint is unreachable (offline, or a backend that
 * predates it) the site runs on defaults — everything on, nothing blocked —
 * which is exactly how it behaved before these settings existed.
 */
export async function getPublicSettings(): Promise<SiteSettings> {
  try {
    const data = await api.get<Partial<SiteSettings>>("/settings/public");
    return withDefaults(data);
  } catch {
    return DEFAULT_SITE_SETTINGS;
  }
}

export interface FeatureCatalogEntry {
  key: FeatureKey;
  label: string;
  description: string;
  roles: AccountType[];
}

/** Credentials never come back from the API: `<field>_set` and a hint instead. */
export interface SmsSettings {
  api_key: string;
  api_key_set?: boolean;
  api_key_hint?: string;
  sender: string;
}

/** The owner's Telegram bot. api_base is an optional relay for hosts that cannot reach Telegram. */
export interface TelegramSettings {
  bot_token: string;
  bot_token_set?: boolean;
  bot_token_hint?: string;
  chat_id: string;
  api_base: string;
}

export interface MailSettings {
  from_address: string;
  from_name: string;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: "ssl" | "tls";
  smtp_user: string;
  smtp_pass: string;
  smtp_pass_set?: boolean;
  smtp_pass_hint?: string;
}

/** Where each delivery setting in effect comes from. */
export interface DeliveryStatus {
  sms_api_key: "panel" | "config" | "none";
  sms_sender: "panel" | "config" | "none";
  mail: "panel" | "config" | "mail()";
}

export interface AdminSiteSettings {
  settings: SiteSettings & { sms: SmsSettings; mail: MailSettings; telegram: TelegramSettings };
  featureCatalog: FeatureCatalogEntry[];
  /** False until app-settings-update.sql has been run on the database. */
  storageReady: boolean;
  delivery: DeliveryStatus | null;
  /** The host's PHP upload ceiling, which no limit here can exceed. */
  server: { upload_max_mb: number | null; post_max_mb: number | null } | null;
}

export async function getAdminSiteSettings(): Promise<AdminSiteSettings> {
  const data = await api.get<{
    settings: AdminSiteSettings["settings"];
    feature_catalog: FeatureCatalogEntry[];
    storage_ready: boolean;
    delivery?: DeliveryStatus;
    server?: AdminSiteSettings["server"];
  }>("/admin/settings");

  return {
    settings: { ...DEFAULT_SITE_SETTINGS, ...data.settings },
    featureCatalog: data.feature_catalog,
    storageReady: data.storage_ready,
    delivery: data.delivery ?? null,
    server: data.server ?? null,
  };
}

type AdminSettingValues = AdminSiteSettings["settings"];
export type AdminSettingKey = keyof AdminSettingValues;

/**
 * clearSecrets names credential fields to empty; otherwise an empty one is
 * left as it is on the server.
 */
export async function updateSiteSetting<K extends AdminSettingKey>(
  key: K,
  value: AdminSettingValues[K],
  clearSecrets: string[] = []
): Promise<AdminSettingValues[K]> {
  const data = await api.put<{ value: AdminSettingValues[K] }>(`/admin/settings/${key}`, {
    value,
    clear_secrets: clearSecrets,
  });
  return data.value;
}

/** Uploads a new logo (PNG, JPG or WebP); returns the whole branding group as saved. */
export async function uploadBrandLogo(file: File): Promise<BrandingSettings> {
  const data = await api.upload<{ value: BrandingSettings }>("/admin/branding/logo", file);
  return data.value;
}

export async function removeBrandLogo(): Promise<BrandingSettings> {
  const data = await api.delete<{ value: BrandingSettings }>("/admin/branding/logo");
  return data.value;
}

export async function sendTestSms(phone: string) {
  await api.post("/admin/settings/test-sms", { phone });
}

export async function sendTestTelegram() {
  await api.post("/admin/settings/test-telegram", {});
}

export async function sendTestMail(email: string) {
  await api.post("/admin/settings/test-mail", { email });
}

/**
 * Whether the user's plan opens the section: what the admin set for their
 * account by hand wins; else their tier's (none = not limited) say.
 */
export function isTierAllowed(
  tiers: TiersSettings,
  key: FeatureKey,
  tier: { key: TierKey | null; access?: Partial<Record<FeatureKey, boolean>> } | null | undefined
): boolean {
  const set = tier?.access?.[key];
  if (set !== undefined) return set;
  if (!tier?.key) return true;
  return tiers[tier.key]?.features?.[key] !== false;
}

export function isFeatureEnabled(
  features: FeatureSettings,
  key: FeatureKey,
  role: AccountType | null | undefined
): boolean {
  const state = features[key];
  if (!state) return true;
  if (!state.enabled) return false;
  return !role || state.roles[role] !== false;
}
