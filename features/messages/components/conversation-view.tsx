"use client";

import { useEffect, useRef } from "react";
import { Apple, ArrowRight, Dumbbell, MessageCircle } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime, toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import { useConversation } from "../hooks/use-conversation";
import { useSendMessage } from "../hooks/use-send-message";
import { MessageComposer } from "./message-composer";
import type { MessageThread } from "../types/message-types";

const PLAN_ICON = { workout: Dumbbell, nutrition: Apple } as const;

const ROLE_LABEL = { trainer: "مربی شما", athlete: "ورزشکار" } as const;

export function ConversationView({
  thread,
  currentUserId,
  onBack,
}: {
  thread: MessageThread;
  currentUserId: string;
  onBack?: () => void;
}) {
  const conversation = useConversation(thread.counterpartId);
  const sendMessage = useSendMessage(thread.counterpartId);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = conversation.data?.messages ?? [];
  const plans = conversation.data?.plans ?? [];

  // Land on the newest message, the way a chat does — including after a
  // reply arrives over Realtime while the thread is open.
  useEffect(() => {
    const container = scrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages.length]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        {onBack && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onBack}
            aria-label="بازگشت به فهرست گفتگوها"
          >
            <ArrowRight />
          </Button>
        )}
        <Avatar className="size-10 shrink-0">
          <AvatarImage src={thread.avatarUrl ?? undefined} />
          <AvatarFallback className="text-xs">{thread.name.slice(0, 2)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{thread.name}</p>
          <p className="text-xs text-muted-foreground">
            {ROLE_LABEL[thread.counterpartRole]}
            {thread.planCount > 0
              ? ` · ${toPersianDigits(thread.planCount)} برنامه مشترک`
              : " · هنوز برنامه‌ای ثبت نشده"}
          </p>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {conversation.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-14 w-2/3 rounded-xl" />
            <Skeleton className="h-14 w-1/2 rounded-xl" />
            <Skeleton className="h-14 w-3/5 rounded-xl" />
          </div>
        ) : conversation.isError ? (
          <ErrorState message="بارگذاری گفتگو با خطا مواجه شد." />
        ) : messages.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="هنوز پیامی رد و بدل نشده است."
            description="اولین پیام را شما بنویسید. اگر درباره یکی از برنامه‌هاست، می‌توانید آن را هم انتخاب کنید."
          />
        ) : (
          <ul className="space-y-3">
            {messages.map((message, index) => {
              const isOwn = message.authorId === currentUserId;
              // Plan-attached messages and plain ones share one timeline, so
              // the plan is named whenever it changes — a chip on every
              // message would be noise in a run about the same plan, and a
              // direct message has nothing to name.
              const showPlan =
                message.planId !== null &&
                (index === 0 || messages[index - 1].planId !== message.planId);
              const PlanIcon = message.planKind ? PLAN_ICON[message.planKind] : null;

              return (
                <li key={message.id} className="space-y-2">
                  {showPlan && (
                    <div className="flex items-center justify-center">
                      <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">
                        {PlanIcon && <PlanIcon className="size-3" />}
                        {message.planTitle}
                      </span>
                    </div>
                  )}

                  <div className={cn("flex items-start gap-2", isOwn && "flex-row-reverse")}>
                    <Avatar className="size-7 shrink-0">
                      <AvatarImage src={message.authorAvatarUrl ?? undefined} />
                      <AvatarFallback className="text-[10px]">
                        {message.authorName.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={cn(
                        "min-w-0 max-w-[85%] space-y-0.5 rounded-xl px-3 py-2 text-sm",
                        isOwn ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                      )}
                    >
                      <div
                        className={cn(
                          "flex items-baseline gap-2 text-[11px]",
                          isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                        )}
                      >
                        <span className="font-medium">{message.authorName}</span>
                        <span>{formatRelativeTime(new Date(message.createdAt))}</span>
                      </div>
                      <p className="whitespace-pre-line break-words">{message.body}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {conversation.isLoading ? null : (
        <MessageComposer
          plans={plans}
          isPending={sendMessage.isPending}
          onSend={async (input) => {
            await sendMessage.mutateAsync(input);
          }}
        />
      )}
    </div>
  );
}
