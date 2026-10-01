"use client";

import { useEffect } from "react";

import { usePublicSettings } from "@/features/site-settings/hooks/use-site-settings";
import { applyBrandColor } from "@/lib/brand-theme";
import { DEFAULT_BRAND_NAME } from "./brand-mark";

/**
 * Applies the admin's branding (settings → branding) to the running page:
 * the main color, the name in the browser tab, and the logo as the tab's
 * icon. What is baked in at build time stays Gymlic's until a rebuild: the
 * installed app's name and icon (manifest) and what a link preview shows.
 */
export function BrandTheme() {
  const { branding } = usePublicSettings();
  const { primary_color: color, app_name: name, logo_url: logo } = branding;

  useEffect(() => {
    applyBrandColor(color || null);
  }, [color]);

  // Every page's title says جیم‌لیک (static metadata); swap in the name,
  // now and on each navigation.
  useEffect(() => {
    if (!name || name === DEFAULT_BRAND_NAME) return;
    const rename = () => {
      if (document.title.includes(DEFAULT_BRAND_NAME)) {
        document.title = document.title.split(DEFAULT_BRAND_NAME).join(name);
      }
    };
    rename();
    const observer = new MutationObserver(rename);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [name]);

  useEffect(() => {
    if (!logo) return;
    const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));
    const original = links.map((link) => link.href);
    for (const link of links) link.href = logo;
    return () => links.forEach((link, i) => (link.href = original[i]));
  }, [logo]);

  return null;
}
