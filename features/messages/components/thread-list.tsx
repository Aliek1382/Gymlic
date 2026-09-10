"use client";

import { useState } from "react";
import { MessageCircle, Search } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime, toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import type { MessageThread } from "../types/message-types";

// A trainer's inbox can get long (one row per athlete they've written a
// plan for), an athlete's is usually a single row — so the filter box only
// appears once there's actually something to filter.
const SEARCH_THRESHOLD = 5;

export function ThreadList({
  threads,
  isLoading,
  selectedId,
  onSelect,
  emptyTitle,
  emptyDescription,
}: {
  threads: MessageThread[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (counterpartId: string) => void;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const [search, setSearch] = useState("");

  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <EmptyState icon={MessageCircle} title={emptyTitle} description={emptyDescription} />
    );
  }

  const term = search.trim();
  const visible = term
    ? threads.filter((thread) => thread.name.includes(term))
    : threads;

  return (
    <div className="flex min-h-0 flex-col">
      {threads.length >= SEARCH_THRESHOLD && (
        <div className="relative p-3">
          <Search className="pointer-events-none absolute right-6 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="جستجوی نام..."
            className="h-10 pr-10"
          />
        </div>
      )}

      {visible.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          گفتگویی با این نام پیدا نشد.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {visible.map((thread) => (
            <li key={thread.counterpartId}>
              <button
                type="button"
                onClick={() => onSelect(thread.counterpartId)}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-border px-4 py-3 text-right transition-colors hover:bg-muted",
                  thread.counterpartId === selectedId && "bg-muted"
                )}
              >
                <Avatar className="size-10 shrink-0">
                  <AvatarImage src={thread.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-xs">
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
                      "line-clamp-1 text-xs",
                      thread.unreadCount > 0
                        ? "font-medium text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {thread.lastMessageBody ?? "هنوز پیامی رد و بدل نشده است."}
                  </p>
                </div>

                {thread.unreadCount > 0 && (
                  <span className="mt-1 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-medium leading-none text-primary-foreground">
                    {toPersianDigits(thread.unreadCount)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
