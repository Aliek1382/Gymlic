"use client";

import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatRelativeTime, toPersianDigits } from "@/lib/persian";
import { useMarkAllNotificationsRead, useMarkNotificationRead } from "../hooks/use-notification-actions";
import { useNotifications } from "../hooks/use-notifications";
import { NOTIFICATION_ICON } from "../constants/notifications";
import type { NotificationItem } from "../types/notification-types";

interface NotificationBellProps {
  userId: string;
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const { data, isLoading } = useNotifications(userId);
  const markRead = useMarkNotificationRead(userId);
  const markAllRead = useMarkAllNotificationsRead(userId);

  const notifications = data ?? [];
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          aria-label="اعلان‌ها"
        >
          <Bell className="size-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium leading-none text-destructive-foreground">
              {unreadCount > 9 ? "۹+" : toPersianDigits(unreadCount)}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] max-w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2.5">
          <p className="text-sm font-semibold text-foreground">اعلان‌ها</p>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="size-3.5" />
              علامت‌گذاری همه
            </button>
          )}
        </div>
        <div className="h-px bg-border" />

        <ScrollArea className="h-[22rem]">
          {isLoading ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              در حال بارگذاری...
            </p>
          ) : notifications.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              اعلانی وجود ندارد.
            </p>
          ) : (
            <ul>
              {notifications.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onRead={() => {
                    if (!notification.isRead) markRead.mutate(notification.id);
                  }}
                />
              ))}
            </ul>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationRow({
  notification,
  onRead,
}: {
  notification: NotificationItem;
  onRead: () => void;
}) {
  const Icon = NOTIFICATION_ICON[notification.type] ?? Bell;

  const content = (
    <div
      className={cn(
        "flex w-full items-start gap-3 px-3 py-3 text-right transition-colors hover:bg-muted",
        !notification.isRead && "bg-primary/5"
      )}
    >
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium text-foreground">{notification.title}</p>
        {notification.body && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>
        )}
        <p className="text-[11px] text-muted-foreground">
          {formatRelativeTime(new Date(notification.createdAt))}
        </p>
      </div>
      {!notification.isRead && (
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
      )}
    </div>
  );

  return (
    <li className="border-b border-border last:border-0">
      {notification.link ? (
        <Link href={notification.link} onClick={onRead}>
          {content}
        </Link>
      ) : (
        <button type="button" onClick={onRead} className="block w-full">
          {content}
        </button>
      )}
    </li>
  );
}
