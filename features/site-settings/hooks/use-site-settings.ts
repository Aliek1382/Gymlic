"use client";

import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuthContext } from "@/features/authentication/hooks/use-auth-context";
import type { FeatureKey } from "../constants";
import {
  DEFAULT_SITE_SETTINGS,
  getAdminSiteSettings,
  getPublicSettings,
  isFeatureEnabled,
  isTierAllowed,
  removeBrandLogo,
  updateSiteSetting,
  uploadBrandLogo,
  withDefaults,
  type AdminSettingKey,
  type AdminSiteSettings,
  type SiteSettings,
} from "../services/site-settings-service";

const PUBLIC_KEY = ["site-settings", "public"] as const;
const ADMIN_KEY = ["site-settings", "admin"] as const;

/**
 * The admin's switches as every page sees them. Refreshed on focus and every
 * few minutes, so a change in /admin reaches open tabs without a reload.
 * Until the first answer arrives this is the defaults, i.e. everything on.
 */
export function usePublicSettings(): SiteSettings {
  const { data } = useQuery({
    queryKey: PUBLIC_KEY,
    queryFn: getPublicSettings,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
  });
  // The offline cache (lib/query-persist.ts) can hand back a snapshot saved
  // before a group existed, which never passed through getPublicSettings.
  return useMemo(() => (data ? withDefaults(data) : DEFAULT_SITE_SETTINGS), [data]);
}

/**
 * Whether a section is on for the signed-in user. A platform admin always
 * gets true, matching the API, which lets an admin through too.
 */
export function useFeatureCheck(): (key: FeatureKey | null) => boolean {
  const { features, tiers } = usePublicSettings();
  const { data: context } = useAuthContext();
  const role = context?.accountType;
  const tier = context?.tier;
  const isAdmin = !!context?.isPlatformAdmin;

  return useCallback(
    (key: FeatureKey | null) =>
      !key || isAdmin || (isFeatureEnabled(features, key, role) && isTierAllowed(tiers, key, tier)),
    [features, tiers, role, tier, isAdmin]
  );
}

export function useFeatureEnabled(key: FeatureKey): boolean {
  return useFeatureCheck()(key);
}

export function useAdminSiteSettings() {
  return useQuery({ queryKey: ADMIN_KEY, queryFn: getAdminSiteSettings });
}

export function useUpdateSiteSetting<K extends AdminSettingKey>(key: K) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ value, clearSecrets }: { value: AdminSiteSettings["settings"][K]; clearSecrets?: string[] }) =>
      updateSiteSetting(key, value, clearSecrets),
    onSuccess: (saved) => {
      // Straight into the cache, not only via a refetch: the next switch the
      // admin flips builds on this value, and must not build on a stale one.
      queryClient.setQueryData<AdminSiteSettings>(ADMIN_KEY, (old) =>
        old ? { ...old, settings: { ...old.settings, [key]: saved } } : old
      );
      void queryClient.invalidateQueries({ queryKey: ["site-settings"] });
    },
  });
}

/** Uploads a new logo, or with null goes back to the Gymlic mark. */
export function useSetBrandLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File | null) => (file ? uploadBrandLogo(file) : removeBrandLogo()),
    onSuccess: (saved) => {
      queryClient.setQueryData<AdminSiteSettings>(ADMIN_KEY, (old) =>
        old ? { ...old, settings: { ...old.settings, branding: saved } } : old
      );
      void queryClient.invalidateQueries({ queryKey: ["site-settings"] });
    },
  });
}
