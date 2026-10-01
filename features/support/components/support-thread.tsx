"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Headset, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getErrorMessage } from "@/lib/get-error-message";
import { formatRelativeTime, toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";
import {
  MAX_SUPPORT_BODY,
  SUPPORT_CATEGORY_LABEL,
  type SupportCategory,
  type SupportMessage,
  type SupportStatus,
} from "../services/support-service";
import { SupportStatusBadge } from "./support-status-badge";

/**
 * One support conversation — used both by the user (/support) and by the
 * admin's inbox (/admin/support). Messages from "our" side sit on the left
 * in the primary colour: the user's own for the user, support's for the admin.
 */
export function SupportThread({
  viewer,
  ticket,
  messages,
  subtitle,
  actions,
  onBack,
  onSend,
  sendExtra,
}: {
  viewer: "user" | "admin";
  ticket: { ticket_number: number; category: SupportCategory; subject: string; status: SupportStatus };
  messages: SupportMessage[];
  /** Under the subject: e.g. who opened it, for the admin. */
  subtitle?: ReactNode;
  /** Status buttons and the like, in the header. */
  actions?: ReactNode;
  onBack: () => void;
  onSend: (body: string, close: boolean) => Promise<void>;
  /** The admin's "send and close". */
  sendExtra?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState<"send" | "close" | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages.length]);

  async function send(close: boolean) {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(close ? "close" : "send");
    try {
      await onSend(body, close);
      setDraft("");
    } catch (error) {
      toast.error(getErrorMessage(error, "ارسال پیام با خطا مواجه شد."));
    } finally {
      setSending(null);
    }
  }

  return (
    <Card className="flex min-h-[28rem] flex-col gap-0 overflow-hidden p-0">
      <div className="space-y-3 border-b border-border p-4">
        <div className="flex items-start gap-2">
          <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="بازگشت به فهرست">
            <ArrowRight />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">
              تیکت #{toPersianDigits(ticket.ticket_number)} · {SUPPORT_CATEGORY_LABEL[ticket.category]}
            </p>
            <h2 className="break-words text-base font-bold text-foreground">{ticket.subject}</h2>
            {subtitle}
          </div>
          <SupportStatusBadge status={ticket.status} forAdmin={viewer === "admin"} />
        </div>
        {actions}
      </div>

      <div ref={scrollRef} className="max-h-[32rem] min-h-0 flex-1 overflow-y-auto p-4">
        <ul className="space-y-3">
          {messages.map((message) => {
            const ours = viewer === "admin" ? message.from_admin : !message.from_admin;
            return (
              <li key={message.id} className={cn("flex items-start gap-2", ours && "flex-row-reverse")}>
                <div
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-[10px]",
                    message.from_admin ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  {message.from_admin ? <Headset className="size-3.5" /> : (message.sender_name ?? "؟").slice(0, 2)}
                </div>
                <div
                  className={cn(
                    "min-w-0 max-w-[85%] space-y-0.5 rounded-xl px-3 py-2 text-sm",
                    ours ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  )}
                >
                  <div
                    className={cn(
                      "flex items-baseline gap-2 text-[11px]",
                      ours ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}
                  >
                    <span className="font-medium">{message.sender_name || "—"}</span>
                    <span>{formatRelativeTime(new Date(message.created_at))}</span>
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
          <p className="text-xs text-muted-foreground">این تیکت بسته است؛ پیام جدید آن را دوباره باز می‌کند.</p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value.slice(0, MAX_SUPPORT_BODY))}
            rows={3}
            placeholder={viewer === "admin" ? "پاسخ به کاربر…" : "پیام خود را بنویسید…"}
            className="flex-1 resize-none rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
          />
          <div className="flex flex-col gap-2">
            <Button type="button" disabled={!!sending || !draft.trim()} onClick={() => send(false)}>
              {sending === "send" ? <Loader2 className="animate-spin" /> : <Send />}
              ارسال
            </Button>
            {sendExtra && (
              <Button type="button" variant="outline" disabled={!!sending || !draft.trim()} onClick={() => send(true)}>
                {sending === "close" && <Loader2 className="animate-spin" />}
                ارسال و بستن
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
