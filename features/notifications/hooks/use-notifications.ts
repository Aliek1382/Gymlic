"use client";

import { useQuery } from "@tanstack/react-query";

import { INBOX_POLL_MS } from "@/lib/api/polling";
import { getNotifications } from "../services/notification-service";

export function notificationsQueryKey(userId: string | null) {
  return ["notifications", "list", userId];
}

/**
 * Loads the recipient's recent notifications and keeps them fresh by polling.
 * This was a Realtime subscription on the `notifications` table; the PHP API
 * has nothing to push over, so the bell refreshes on a short interval (and on
 * window focus) instead.
 */
export function useNotifications(userId: string | null) {
  return useQuery({
    queryKey: notificationsQueryKey(userId),
    queryFn: getNotifications,
    enabled: !!userId,
    refetchInterval: INBOX_POLL_MS,
  });
}
