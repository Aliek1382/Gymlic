"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Ticket as TicketIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatNumber, formatRelativeTime, toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import { TicketStatusBadge } from "@/features/tickets/components/ticket-status-badge";
import {
  TICKET_CATEGORY_LABEL,
  TICKET_STATUSES,
  TICKET_STATUS_LABEL,
} from "@/features/tickets/constants/tickets";
import { getAdminTicket, listAdminTickets } from "@/features/tickets/services/ticket-service";
import type { TicketStatus } from "@/features/tickets/types/ticket-types";

/**
 * /admin/tickets — a read-only window on athlete ↔ trainer tickets. The
 * conversation belongs to those two people, so there is no reply box here;
 * the support tickets people send to Gymlic itself live in /admin/support.
 */
export function AdminCoachTicketsPage() {
  const router = useRouter();
  const ticketId = useSearchParams().get("id");
  const [filter, setFilter] = useState<TicketStatus | "all">("open");
  const list = useQuery({
    queryKey: ["admin", "coach-tickets", filter],
    queryFn: () => listAdminTickets(filter === "all" ? undefined : filter),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">تیکت‌های مربی و ورزشکار</h1>
        <p className="text-sm text-muted-foreground">
          درخواست‌هایی که ورزشکاران برای مربی خود باز کرده‌اند، فقط برای مشاهده (مثلاً بررسی اختلاف).
          پاسخ‌دادن در اینجا ممکن نیست؛ تیکت‌هایی که برای خود جیم‌لیک فرستاده‌اند در «تیکت‌های
          پشتیبانی» است.
        </p>
      </div>

      {ticketId ? (
        <TicketView id={ticketId} onBack={() => router.push("/admin/tickets")} />
      ) : (
        <>
          <Tabs value={filter} onValueChange={(value) => setFilter(value as TicketStatus | "all")}>
            <TabsList className="h-auto flex-wrap justify-start rounded-2xl">
              {TICKET_STATUSES.map((status) => (
                <TabsTrigger key={status} value={status}>
                  {TICKET_STATUS_LABEL[status]}
                  {list.data && ` (${formatNumber(list.data.counts[status])})`}
                </TabsTrigger>
              ))}
              <TabsTrigger value="all">همه</TabsTrigger>
            </TabsList>
          </Tabs>

          {list.isLoading ? (
            <Skeleton className="h-48 rounded-2xl" />
          ) : list.isError || !list.data ? (
            <ErrorState message="دریافت تیکت‌ها با خطا مواجه شد." />
          ) : list.data.items.length === 0 ? (
            <Card className="py-8">
              <div className="px-6">
                <EmptyState icon={TicketIcon} title="تیکتی در این وضعیت نیست." />
              </div>
            </Card>
          ) : (
            <Card className="gap-0 py-0">
              <ul className="divide-y divide-border">
                {list.data.items.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => router.push(`/admin/tickets?id=${t.id}`)}
                      className="flex w-full items-center gap-3 px-5 py-4 text-start hover:bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{t.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          #{toPersianDigits(t.ticketNumber)} · {TICKET_CATEGORY_LABEL[t.category]} ·{" "}
                          {t.athleteName} ← {t.trainerName} · {toPersianDigits(t.messageCount)} پیام ·{" "}
                          {formatRelativeTime(new Date(t.updatedAt))}
                        </p>
                      </div>
                      <TicketStatusBadge status={t.status} />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function TicketView({ id, onBack }: { id: string; onBack: () => void }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "coach-tickets", "ticket", id],
    queryFn: () => getAdminTicket(id),
  });

  if (isLoading) return <Skeleton className="h-64 rounded-2xl" />;
  if (isError || !data) return <ErrorState message="بارگذاری تیکت با خطا مواجه شد." />;

  const { ticket, messages } = data;

  return (
    <Card className="gap-0 p-0">
      <div className="flex items-start gap-2 border-b border-border p-4">
        <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="بازگشت">
          <ArrowRight />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">
            تیکت #{toPersianDigits(ticket.ticketNumber)} · {TICKET_CATEGORY_LABEL[ticket.category]} ·
            ورزشکار: {ticket.athleteName} · مربی: {ticket.trainerName}
          </p>
          <h2 className="break-words text-base font-bold text-foreground">{ticket.subject}</h2>
        </div>
        <TicketStatusBadge status={ticket.status} />
      </div>

      <ul className="space-y-3 p-4">
        {messages.map((message) => {
          const fromAthlete = message.senderId === ticket.athleteId;
          return (
            <li
              key={message.id}
              className={cn(
                "max-w-[85%] space-y-0.5 rounded-xl px-3 py-2 text-sm",
                fromAthlete ? "bg-muted text-foreground" : "ms-auto bg-primary/10 text-foreground"
              )}
            >
              <div className="flex items-baseline gap-2 text-[11px] text-muted-foreground">
                <span className="font-medium">
                  {message.senderName} ({fromAthlete ? "ورزشکار" : "مربی"})
                </span>
                <span>{formatRelativeTime(new Date(message.createdAt))}</span>
              </div>
              <p className="whitespace-pre-line break-words">{message.body}</p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
