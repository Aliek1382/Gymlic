"use client";

import { cn } from "@/lib/utils";
import { usePublicSettings } from "@/features/site-settings/hooks/use-site-settings";
import { GymlicMark } from "./gymlic-mark";

export const DEFAULT_BRAND_NAME = "جیم‌لیک";

/** The name the admin gave the site (settings → branding), or جیم‌لیک. */
export function useBrandName(): string {
  return usePublicSettings().branding.app_name || DEFAULT_BRAND_NAME;
}

export function BrandName() {
  return <>{useBrandName()}</>;
}

/**
 * The logo tile: the admin's uploaded logo when there is one, otherwise the
 * Gymlic mark on its colored tile. className sizes and styles the tile;
 * iconClassName sizes the mark inside it.
 */
export function BrandMark({ className, iconClassName }: { className?: string; iconClassName?: string }) {
  const { branding } = usePublicSettings();
  const name = useBrandName();

  if (branding.logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- static export: no image optimizer
      <img
        src={branding.logo_url}
        alt={name}
        className={cn(className, "shrink-0 bg-transparent object-contain")}
      />
    );
  }
  return (
    <div className={className}>
      <GymlicMark className={iconClassName} />
    </div>
  );
}
