import { api, query, type ListResponse } from "@/lib/api/client";
import type { NewsInput, NewsItem, NewsOrigin, NewsPage } from "../types/news-types";

export const NEWS_PAGE_SIZE = 12;

interface NewsRow {
  id: string;
  origin: NewsOrigin;
  title: string;
  summary: string | null;
  body?: string | null;
  link: string | null;
  image_url: string | null;
  is_published: boolean;
  published_at: string;
}

function toNewsItem(row: NewsRow): NewsItem {
  return {
    id: row.id,
    origin: row.origin,
    title: row.title,
    summary: row.summary,
    body: row.body,
    link: row.link,
    imageUrl: row.image_url,
    isPublished: row.is_published,
    publishedAt: row.published_at,
  };
}

export async function listNews(origin: NewsOrigin | null, offset: number): Promise<NewsPage> {
  const data = await api.get<ListResponse<NewsRow> & { has_more: boolean }>(
    `/news${query({ origin, limit: NEWS_PAGE_SIZE, offset })}`
  );
  return { items: data.items.map(toNewsItem), hasMore: data.has_more };
}

export async function getNews(id: string): Promise<NewsItem> {
  return toNewsItem(await api.get<NewsRow>(`/news/${id}`));
}

// ---- Admin ---------------------------------------------------------------

export async function listAdminNews(): Promise<NewsItem[]> {
  const data = await api.get<ListResponse<NewsRow>>("/admin/news");
  return data.items.map(toNewsItem);
}

export async function getAdminNews(id: string): Promise<NewsItem> {
  return toNewsItem(await api.get<NewsRow>(`/admin/news/${id}`));
}

function toPayload(input: NewsInput) {
  return {
    title: input.title,
    summary: input.summary,
    body: input.body,
    image_url: input.imageUrl,
    is_published: input.isPublished,
  };
}

export async function createNews(input: NewsInput) {
  await api.post("/admin/news", toPayload(input));
}

export async function updateNews(id: string, input: NewsInput) {
  await api.patch(`/admin/news/${id}`, toPayload(input));
}

export async function deleteNews(id: string) {
  await api.delete(`/admin/news/${id}`);
}
