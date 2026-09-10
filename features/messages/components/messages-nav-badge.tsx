"use client";

import { toPersianDigits } from "@/lib/persian";
import { useUnreadMessageCount } from "../hooks/use-message-threads";

// The unread count next to the sidebar's "پیام‌ها" entry. Shares the inbox
// query (and its Realtime subscription), so it lights up the moment a
// message arrives on any page of the panel.
export function MessagesNavBadge() {
  const unreadCount = useUnreadMessageCount();
  if (unreadCount === 0) return null;

  return (
    <span className="ms-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-medium leading-none text-primary-foreground">
      {unreadCount > 9 ? "۹+" : toPersianDigits(unreadCount)}
    </span>
  );
}
