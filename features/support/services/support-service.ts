import { api } from "@/lib/api/client";

export type SupportStatus = "open" | "answered" | "closed";
export type SupportCategory = "bug" | "billing" | "account" | "suggestion" | "other";

export const SUPPORT_CATEGORIES: SupportCategory[] = ["bug", "billing", "account", "suggestion", "other"];

export const SUPPORT_CATEGORY_LABEL: Record<SupportCategory, string> = {
  bug: "مشکل فنی",
  billing: "مالی و اشتراک",
  account: "حساب کاربری",
  suggestion: "پیشنهاد",
  other: "سایر",
};

export const SUPPORT_STATUS_LABEL: Record<SupportStatus, string> = {
  open: "در انتظار پاسخ",
  answered: "پاسخ داده شد",
  closed: "بسته",
};

export const MAX_SUPPORT_BODY = 3000;

export interface SupportTicket {
  id: string;
  ticket_number: number;
  category: SupportCategory;
  subject: string;
  status: SupportStatus;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

export interface SupportMessage {
  id: string;
  from_admin: boolean;
  body: string;
  created_at: string;
  sender_name: string | null;
}

export function listMySupportTickets() {
  return api.get<{ ready: boolean; items: SupportTicket[] }>("/support");
}

export function createSupportTicket(input: { category: SupportCategory; subject: string; body: string }) {
  return api.post<{ id: string; ticket_number: number }>("/support", input);
}

export function getMySupportTicket(id: string) {
  return api.get<{ ticket: SupportTicket; messages: SupportMessage[] }>(`/support/${id}`);
}

export async function replyToSupportTicket(id: string, body: string) {
  await api.post(`/support/${id}/messages`, { body });
}

export async function closeSupportTicket(id: string) {
  await api.post(`/support/${id}/close`);
}
