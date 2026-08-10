"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import { getNotifications } from "../services/notification-service";

export function notificationsQueryKey(userId: string | null) {
  return ["notifications", "list", userId];
}

/**
 * Loads the recipient's recent notifications and keeps them live: a
 * Realtime subscription on the `notifications` table invalidates the query
 * whenever a row for this user changes, so the bell updates without a
 * refresh (new notification arrives, or another tab marks one as read).
 */
export function useNotifications(userId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = notificationsQueryKey(userId);

  const query = useQuery({
    queryKey,
    queryFn: () => getNotifications(userId as string),
    enabled: !!userId,
  });

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: notificationsQueryKey(userId) });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return query;
}
