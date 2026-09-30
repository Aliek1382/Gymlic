import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TICKET_STATUS_LABEL } from "../constants/tickets";
import type { TicketStatus } from "../types/ticket-types";

const STATUS_CLASS: Record<TicketStatus, string> = {
  open: "bg-primary/10 text-primary",
  in_progress: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  closed: "bg-muted text-muted-foreground",
};

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return (
    <Badge variant="secondary" className={cn("border-0", STATUS_CLASS[status])}>
      {TICKET_STATUS_LABEL[status]}
    </Badge>
  );
}
