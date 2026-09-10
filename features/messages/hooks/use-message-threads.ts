"use client";

import { useEffect, useId } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import { listMessageThreads } from "../services/message-service";

export function messageThreadsQueryKey() {
  return ["messages", "threads"];
}

/**
 * The inbox list, kept live the same way the notification bell is: any
 * message arriving or being marked read re-runs the aggregate, so a reply
 * shows up without a refresh. Realtime respects RLS, so only rows this user
 * may see ever arrive.
 */
export function useMessageThreads() {
  const queryClient = useQueryClient();
  // supabase.channel() hands back the *existing* channel when the topic is
  // already taken, so a fixed name would give every subscriber the same
  // instance — and the first one to unmount would tear it down for the rest
  // (the sidebar badge and the inbox are both on screen at /messages). A
  // per-subscriber topic keeps them independent.
  const channelId = useId();

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
      .channel(`message-threads:${channelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        invalidate
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, queryClient]);

  return query;
}

/** Total unread messages across every conversation — the sidebar badge. */
export function useUnreadMessageCount(): number {
  const threads = useMessageThreads();
  return (threads.data ?? []).reduce((total, thread) => total + thread.unreadCount, 0);
}
