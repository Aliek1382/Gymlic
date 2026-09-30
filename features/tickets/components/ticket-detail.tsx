"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatRelativeTime, toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import {
  MAX_TICKET_BODY_LENGTH,
  TICKET_CATEGORY_LABEL,
  TICKET_STATUSES,
  TICKET_STATUS_LABEL,
} from "../constants/tickets";
import { useAddTicketMessage, useSetTicketStatus, useTicket } from "../hooks/use-tickets";
import { TicketStatusBadge } from "./ticket-status-badge";

export function TicketDetail({
  ticketId,
  currentUserId,
  role,
  onBack,
}: {
  ticketId: string;
  currentUserId: string;
  role: "athlete" | "trainer";
  onBack: () => void;
}) {
  const detail = useTicket(ticketId);
  const addMessage = useAddTicketMessage(ticketId);
  const setStatus = useSetTicketStatus(ticketId);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageCount = detail.data?.messages.length ?? 0;

  useEffect(() => {
    const container = scrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messageCount]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || addMessage.isPending) return;
    try {
      await addMessage.mutateAsync(body);
      setDraft("");
    } catch (error) {
      toast.error(getErrorMessage(error, "ارسال پیام با خطا مواجه شد."));
    }
  }

  async function handleStatus(status: (typeof TICKET_STATUSES)[number]) {
    try {
      await setStatus.mutateAsync(status);
    } catch (error) {
      toast.error(getErrorMessage(error, "تغییر وضعیت با خطا مواجه شد."));
    }
  }

  if (detail.isLoading) return <Skeleton className="h-64 rounded-xl" />;
  if (detail.isError || !detail.data) {
    return <ErrorState message="بارگذاری تیکت با خطا مواجه شد." />;
  }

  const { ticket, messages } = detail.data;

  return (
    <Card className="flex min-h-[28rem] flex-col gap-0 overflow-hidden p-0">
      <div className="space-y-3 border-b border-border p-4">
        <div className="flex items-start gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="بازگشت به فهرست تیکت‌ها"
          >
            <ArrowRight />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">
              تیکت #{toPersianDigits(ticket.ticketNumber)} ·{" "}
              {TICKET_CATEGORY_LABEL[ticket.category]} ·{" "}
              {role === "trainer" ? ticket.athleteName : ticket.trainerName}
            </p>
            <h2 className="break-words text-base font-bold text-foreground">{ticket.subject}</h2>
          </div>
          <TicketStatusBadge status={ticket.status} />
        </div>

        {role === "trainer" && (
          <div className="flex flex-wrap gap-2">
            {TICKET_STATUSES.map((status) => (
              <Button
                key={status}
                type="button"
                size="sm"
                variant={ticket.status === status ? "default" : "outline"}
                disabled={setStatus.isPending || ticket.status === status}
                onClick={() => handleStatus(status)}
              >
                {TICKET_STATUS_LABEL[status]}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div ref={scrollRef} className="max-h-[28rem] min-h-0 flex-1 overflow-y-auto p-4">
        <ul className="space-y-3">
          {messages.map((message) => {
            const isOwn = message.senderId === currentUserId;
            return (
              <li key={message.id} className={cn("flex items-start gap-2", isOwn && "flex-row-reverse")}>
                <Avatar className="size-7 shrink-0">
                  <AvatarImage src={message.senderAvatarUrl ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {message.senderName.slice(0, 2)}
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
                    <span className="font-medium">{message.senderName}</span>
                    <span>{formatRelativeTime(new Date(message.createdAt))}</span>
                  </div>
                  <p className="whitespace-pre-line break-words">{message.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="space-y-2 border-t border-border p-3">
        {ticket.status === "closed" && (
          <p className="text-xs text-muted-foreground">
            این تیکت بسته است؛ ارسال پیام جدید آن را دوباره باز می‌کند.
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value.slice(0, MAX_TICKET_BODY_LENGTH))}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
            rows={2}
            placeholder="پاسخ خود را بنویسید..."
            className="flex-1 resize-none rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
          />
          <Button
            type="button"
            size="icon"
            disabled={addMessage.isPending || !draft.trim()}
            onClick={handleSend}
            aria-label="ارسال پیام"
          >
            {addMessage.isPending ? <Loader2 className="animate-spin" /> : <Send />}
          </Button>
        </div>
      </div>
    </Card>
  );
}
