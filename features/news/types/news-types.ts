/** `admin` = written in the admin panel; `wordpress` = imported from gymlic.ir's feed. */
export type NewsOrigin = "admin" | "wordpress";

export interface NewsItem {
  id: string;
  origin: NewsOrigin;
  title: string;
  summary: string | null;
  /** Only present when a single item is fetched, and only for admin items. */
  body?: string | null;
  /** Only wordpress items: the article on gymlic.ir. */
  link: string | null;
  imageUrl: string | null;
  isPublished: boolean;
  /** ISO timestamp with its offset. */
  publishedAt: string;
}

export interface NewsPage {
  items: NewsItem[];
  hasMore: boolean;
}

export interface NewsInput {
  title: string;
  summary: string;
  body: string;
  imageUrl: string;
  isPublished: boolean;
}
