"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import { getNotificationsPage } from "../services/notification-service";

export function useNotificationsArchive(userId: string) {
  return useInfiniteQuery({
    queryKey: ["notifications", "archive", userId],
    queryFn: ({ pageParam }) => getNotificationsPage(userId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}
