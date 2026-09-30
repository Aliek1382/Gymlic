import type { TicketCategory, TicketStatus } from "../types/ticket-types";

export const TICKET_CATEGORY_LABEL: Record<TicketCategory, string> = {
  plan: "برنامه",
  nutrition: "تغذیه",
  injury: "آسیب‌دیدگی",
  other: "سایر",
};

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: "باز",
  in_progress: "در حال بررسی",
  closed: "بسته",
};

export const TICKET_STATUSES: TicketStatus[] = ["open", "in_progress", "closed"];

// Same ceilings the API enforces.
export const MAX_TICKET_SUBJECT_LENGTH = 255;
export const MAX_TICKET_BODY_LENGTH = 2000;
