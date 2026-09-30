"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { getNews, listNews } from "../services/news-service";
import type { NewsOrigin } from "../types/news-types";

export function useNewsFeed(origin: NewsOrigin | null) {
  return useInfiniteQuery({
    queryKey: ["news", "feed", origin],
    queryFn: ({ pageParam }) => listNews(origin, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore ? pages.reduce((count, page) => count + page.items.length, 0) : undefined,
  });
}

export function useNewsItem(id: string | null) {
  return useQuery({
    queryKey: ["news", "item", id],
    queryFn: () => getNews(id as string),
    enabled: !!id,
  });
}
