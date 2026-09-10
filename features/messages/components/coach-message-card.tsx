"use client";

import Link from "next/link";
import { ChevronLeft, MessageCircle } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime, toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import { useMessageThreads } from "../hooks/use-message-threads";

// The athlete dashboard's window into the inbox: who wrote last, what they
// said, and one tap into the conversation itself.
const PREVIEW_COUNT = 3;

export function CoachMessageCard({ currentUserId }: { currentUserId: string }) {
  const threads = useMessageThreads();

  const items = (threads.data ?? []).slice(0, PREVIEW_COUNT);

  return (
    <Card className="gap-4 py-5">
      <div className="flex items-center justify-between px-6">
        <CardTitle className="text-base">پیام مربی</CardTitle>
        <Link
          href="/messages"
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          مشاهده همه
          <ChevronLeft className="size-3.5" />
        </Link>
      </div>

      <div className="px-6">
        {threads.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ) : threads.isError ? (
          <ErrorState message="بارگذاری پیام‌ها با خطا مواجه شد." />
        ) : items.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="هنوز گفتگویی با مربی ندارید."
            description="به محض وصل‌شدن به مربی، می‌توانید همین‌جا با او گفتگو کنید."
          />
        ) : (
          <ul className="space-y-1">
            {items.map((thread) => {
              const isOwnLastMessage = thread.lastMessageAuthorId === currentUserId;
              return (
                <li key={thread.counterpartId}>
                  <Link
                    href={`/messages?with=${thread.counterpartId}`}
                    className="flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted"
                  >
                    <Avatar className="size-9 shrink-0">
                      <AvatarImage src={thread.avatarUrl ?? undefined} />
                      <AvatarFallback className="text-[10px]">
                        {thread.name.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-medium text-foreground">
                          {thread.name}
                        </p>
                        {thread.lastMessageAt && (
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {formatRelativeTime(new Date(thread.lastMessageAt))}
                          </span>
                        )}
                      </div>
                      <p
                        className={cn(
                          "line-clamp-2 text-xs",
                          thread.unreadCount > 0
                            ? "font-medium text-foreground"
                            : "text-muted-foreground"
                        )}
                      >
                        {thread.lastMessageBody
                          ? `${isOwnLastMessage ? "شما: " : ""}${thread.lastMessageBody}`
                          : "هنوز پیامی رد و بدل نشده — اولین پیام را شما بنویسید."}
                      </p>
                    </div>

                    {thread.unreadCount > 0 && (
                      <span className="mt-1 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-medium leading-none text-primary-foreground">
                        {toPersianDigits(thread.unreadCount)}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
