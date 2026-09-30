"use client";

import Link from "next/link";
import { Ticket as TicketIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime, toPersianDigits } from "@/lib/persian";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import { TICKET_CATEGORY_LABEL } from "../constants/tickets";
import { useTicketList } from "../hooks/use-tickets";
import type { TicketStatus } from "../types/ticket-types";
import { TicketStatusBadge } from "./ticket-status-badge";

export function TicketList({
  role,
  status,
  emptyDescription,
}: {
  role: "athlete" | "trainer";
  status?: TicketStatus;
  emptyDescription: string;
}) {
  const tickets = useTicketList(role, status);

  if (tickets.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
    );
  }
  if (tickets.isError) return <ErrorState message="بارگذاری تیکت‌ها با خطا مواجه شد." />;

  const items = tickets.data ?? [];
  if (items.length === 0) {
    return (
      <EmptyState
        icon={TicketIcon}
        title="تیکتی وجود ندارد."
        description={emptyDescription}
      />
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((ticket) => (
        <li key={ticket.id}>
          <Link href={`/tickets?id=${ticket.id}`} className="block">
            <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/50">
              <span className="shrink-0 text-xs text-muted-foreground">
                #{toPersianDigits(ticket.ticketNumber)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{ticket.subject}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {TICKET_CATEGORY_LABEL[ticket.category]} ·{" "}
                  {role === "trainer" ? ticket.athleteName : ticket.trainerName} ·{" "}
                  {formatRelativeTime(new Date(ticket.updatedAt))}
                </p>
              </div>
              <TicketStatusBadge status={ticket.status} />
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
