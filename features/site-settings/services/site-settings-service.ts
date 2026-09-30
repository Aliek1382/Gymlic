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

export interface SiteSettings {
  maintenance: MaintenanceSettings;
  signup: SignupSettings;
  announcement: AnnouncementSettings;
  support: SupportSettings;
  features: FeatureSettings;
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
};

/**
 * Never throws: if the endpoint is unreachable (offline, or a backend that
 * predates it) the site runs on defaults — everything on, nothing blocked —
 * which is exactly how it behaved before these settings existed.
 */
export async function getPublicSettings(): Promise<SiteSettings> {
  try {
    const data = await api.get<Partial<SiteSettings>>("/settings/public");
    return { ...DEFAULT_SITE_SETTINGS, ...data };
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

export interface AdminSiteSettings {
  settings: SiteSettings;
  featureCatalog: FeatureCatalogEntry[];
  /** False until app-settings-update.sql has been run on the database. */
  storageReady: boolean;
}

export async function getAdminSiteSettings(): Promise<AdminSiteSettings> {
  const data = await api.get<{
    settings: SiteSettings;
    feature_catalog: FeatureCatalogEntry[];
    storage_ready: boolean;
  }>("/admin/settings");

  return {
    settings: data.settings,
    featureCatalog: data.feature_catalog,
    storageReady: data.storage_ready,
  };
}

export async function updateSiteSetting<K extends SiteSettingKey>(
  key: K,
  value: SiteSettings[K]
): Promise<SiteSettings[K]> {
  const data = await api.put<{ value: SiteSettings[K] }>(`/admin/settings/${key}`, { value });
  return data.value;
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
