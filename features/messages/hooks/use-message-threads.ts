"use client";

import { useQuery } from "@tanstack/react-query";

import { INBOX_POLL_MS } from "@/lib/api/polling";
import { listMessageThreads } from "../services/message-service";

export function messageThreadsQueryKey() {
  return ["messages", "threads"];
}

/**
 * The inbox list, kept fresh the same way the notification bell is: polled on
 * a short interval, so a reply shows up without a refresh.
 */
export function useMessageThreads() {
  return useQuery({
    queryKey: messageThreadsQueryKey(),
    queryFn: listMessageThreads,
    refetchInterval: INBOX_POLL_MS,
  });
}

/** Total unread messages across every conversation — the sidebar badge. */
export function useUnreadMessageCount(): number {
  const threads = useMessageThreads();
  return (threads.data ?? []).reduce((total, thread) => total + thread.unreadCount, 0);
}
