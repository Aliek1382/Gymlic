"use client";

import Link from "next/link";
import { Bell, CheckCheck, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatRelativeTime, toPersianDigits } from "@/lib/persian";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { useMarkAllNotificationsRead, useMarkNotificationRead } from "../hooks/use-notification-actions";
import { useNotificationsArchive } from "../hooks/use-notifications-archive";
import { NOTIFICATION_ICON } from "../constants/notifications";
import type { NotificationItem } from "../types/notification-types";

export function NotificationArchiveList({ userId }: { userId: string }) {
  const archive = useNotificationsArchive(userId);
  const markRead = useMarkNotificationRead(userId);
  const markAllRead = useMarkAllNotificationsRead(userId);

  const notifications = archive.data?.pages.flatMap((page) => page.items) ?? [];
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  if (archive.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    );
  }

  if (archive.isError) {
    return (
      <Card className="border-destructive/30 py-5">
        <p className="px-6 text-sm text-destructive">
          دریافت اعلان‌ها با خطا مواجه شد. صفحه را دوباره بارگذاری کنید.
        </p>
      </Card>
    );
  }

  if (notifications.length === 0) {
    return (
      <Card className="py-5">
        <EmptyState
          icon={Bell}
          title="اعلانی وجود ندارد."
          description="اعلان‌های جدید همین‌جا نمایش داده می‌شوند."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {unreadCount > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {toPersianDigits(unreadCount)} اعلان خوانده‌نشده
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => markAllRead.mutate()}
          >
            <CheckCheck className="size-3.5" />
            علامت‌گذاری همه
          </Button>
        </div>
      )}

      <Card className="gap-0 overflow-hidden py-0">
        <ul>
          {notifications.map((notification) => (
            <ArchiveRow
              key={notification.id}
              notification={notification}
              onRead={() => {
                if (!notification.isRead) markRead.mutate(notification.id);
              }}
            />
          ))}
        </ul>
      </Card>

      {archive.hasNextPage && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => archive.fetchNextPage()}
            disabled={archive.isFetchingNextPage}
          >
            {archive.isFetchingNextPage && <Loader2 className="animate-spin" />}
            بارگذاری بیشتر
          </Button>
        </div>
      )}
    </div>
  );
}

function ArchiveRow({
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
        "flex w-full items-start gap-3 px-4 py-4 text-right transition-colors hover:bg-muted",
        !notification.isRead && "bg-primary/5"
      )}
    >
      <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium text-foreground">{notification.title}</p>
        {notification.body && (
          <p className="text-sm text-muted-foreground">{notification.body}</p>
        )}
        <p className="text-xs text-muted-foreground">
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
