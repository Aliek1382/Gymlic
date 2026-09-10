"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import { useMarkConversationRead } from "../hooks/use-mark-conversation-read";
import { useMessageThreads } from "../hooks/use-message-threads";
import { ConversationView } from "./conversation-view";
import { ThreadList } from "./thread-list";
import type { AccountType } from "@/types/database.types";

const COPY = {
  athlete: {
    emptyTitle: "هنوز گفتگویی ندارید.",
    emptyDescription:
      "به محض اینکه مربی برنامه‌ای برایتان ثبت کند، می‌توانید همین‌جا با او گفتگو کنید.",
  },
  trainer: {
    emptyTitle: "هنوز گفتگویی ندارید.",
    emptyDescription:
      "پس از ثبت اولین برنامه برای یک ورزشکار، گفتگو با او از همین‌جا ممکن می‌شود.",
  },
} as const;

/**
 * The two-pane inbox: conversations on one side, the selected thread on the
 * other. Below `lg` the two swap places instead of sitting side by side —
 * the list until a conversation is picked, then the conversation with a way
 * back.
 */
export function MessageInbox({
  currentUserId,
  role,
  initialCounterpartId,
}: {
  currentUserId: string;
  role: Extract<AccountType, "athlete" | "trainer">;
  initialCounterpartId?: string | null;
}) {
  const threads = useMessageThreads();
  const markRead = useMarkConversationRead();
  const [selectedId, setSelectedId] = useState<string | null>(
    initialCounterpartId ?? null
  );
  const autoSelected = useRef(false);
  const markedKey = useRef<string | null>(null);

  // Memoized so the auto-select effect below isn't re-run by a fresh
  // array identity on every render.
  const items = useMemo(() => threads.data ?? [], [threads.data]);
  const selected = items.find((thread) => thread.counterpartId === selectedId) ?? null;

  // With both panes visible there is no reason to show an empty right-hand
  // side, so the newest conversation opens on its own. On a phone that
  // would skip past the list the user came to see, so it only happens at
  // `lg` and up.
  useEffect(() => {
    if (autoSelected.current || selectedId || items.length === 0) return;
    autoSelected.current = true;
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setSelectedId(items[0].counterpartId);
    }
  }, [items, selectedId]);

  // Reading a conversation clears its unread notifications — and with them
  // the badge in the sidebar and the matching rows in the bell. Keyed on the
  // newest message rather than the person, so a reply that lands while the
  // thread is open is marked read too, without the effect re-firing for one
  // that already was.
  useEffect(() => {
    if (!selected || selected.unreadCount === 0) return;
    const key = `${selected.counterpartId}:${selected.lastMessageAt}`;
    if (markedKey.current === key) return;
    markedKey.current = key;
    markRead.mutate(selected.counterpartId);
  }, [selected, markRead]);

  if (threads.isError) {
    return <ErrorState message="بارگذاری گفتگوها با خطا مواجه شد." />;
  }

  if (!threads.isLoading && items.length === 0) {
    return (
      <Card className="py-5">
        <EmptyState
          icon={MessageCircle}
          title={COPY[role].emptyTitle}
          description={COPY[role].emptyDescription}
        />
      </Card>
    );
  }

  return (
    <Card className="grid h-[calc(100vh-13rem)] min-h-[30rem] gap-0 overflow-hidden py-0 lg:grid-cols-[20rem_1fr]">
      <div
        className={cn(
          "min-h-0 flex-col border-border lg:flex lg:border-l",
          selected ? "hidden lg:flex" : "flex"
        )}
      >
        <ThreadList
          threads={items}
          isLoading={threads.isLoading}
          selectedId={selectedId}
          onSelect={setSelectedId}
          emptyTitle={COPY[role].emptyTitle}
          emptyDescription={COPY[role].emptyDescription}
        />
      </div>

      <div className={cn("min-h-0", selected ? "block" : "hidden lg:block")}>
        {selected ? (
          <ConversationView
            key={selected.counterpartId}
            thread={selected}
            currentUserId={currentUserId}
            onBack={() => setSelectedId(null)}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              icon={MessageCircle}
              title="یک گفتگو را انتخاب کنید."
              description="از فهرست کنار صفحه، گفتگویی را برای خواندن و پاسخ دادن باز کنید."
            />
          </div>
        )}
      </div>
    </Card>
  );
}
