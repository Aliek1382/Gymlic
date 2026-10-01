import { api } from "@/lib/api/client";

export interface SitePageLink {
  slug: string;
  title: string;
}

export interface SitePage extends SitePageLink {
  body: string;
  updated_at: string;
}

/** Published pages, for the site's links. Never throws: no pages = no links. */
export async function listSitePages(): Promise<SitePageLink[]> {
  try {
    const data = await api.get<{ items: SitePageLink[] }>("/pages");
    return data.items;
  } catch {
    return [];
  }
}

export async function getSitePage(slug: string): Promise<SitePage> {
  const data = await api.get<{ page: SitePage }>(`/pages/${encodeURIComponent(slug)}`);
  return data.page;
}
