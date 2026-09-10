"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import { listMessageThreads } from "../services/message-service";

export function messageThreadsQueryKey() {
  return ["messages", "threads"];
}

/**
 * The inbox list, kept live the same way the notification bell is: a new
 * comment anywhere (or a notification of one being read) re-runs the
 * aggregate, so a reply shows up without a refresh. Realtime respects RLS,
 * so only rows this user may see ever arrive.
 */
export function useMessageThreads() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: messageThreadsQueryKey(),
    queryFn: listMessageThreads,
  });

  useEffect(() => {
    const supabase = createClient();
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: messageThreadsQueryKey() });
    };

    const channel = supabase
      .channel("message-threads")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "plan_comments" },
        invalidate
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        invalidate
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

/** Total unread messages across every conversation — the sidebar badge. */
export function useUnreadMessageCount(): number {
  const threads = useMessageThreads();
  return (threads.data ?? []).reduce((total, thread) => total + thread.unreadCount, 0);
}
