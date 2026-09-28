import { api, query, type ListResponse } from "@/lib/api/client";
import type {
  Invoice,
  InvoiceItemType,
  InvoicePaymentMethod,
  InvoiceStatus,
  ManualPaymentMethod,
} from "../types/invoice-types";

interface InvoiceRow {
  id: string;
  number: string;
  athlete_id: string;
  athlete_first_name: string | null;
  athlete_last_name: string | null;
  item_type: InvoiceItemType;
  item_id: string;
  item_title: string | null;
  amount_toman: number;
  status: InvoiceStatus;
  payment_method: InvoicePaymentMethod | null;
  note: string | null;
  paid_at: string | null;
  created_at: string;
}

function toInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    number: row.number,
    athleteId: row.athlete_id,
    athleteName:
      [row.athlete_first_name, row.athlete_last_name].filter(Boolean).join(" ") || "ورزشکار",
    itemType: row.item_type,
    itemId: row.item_id,
    itemTitle: row.item_title,
    amountToman: row.amount_toman,
    status: row.status,
    paymentMethod: row.payment_method,
    note: row.note,
    paidAt: row.paid_at,
    createdAt: row.created_at,
  };
}

/** The trainer's invoices — one athlete's, or all of them when no id is given. */
export async function listInvoices(athleteId?: string): Promise<Invoice[]> {
  const data = await api.get<ListResponse<InvoiceRow>>(
    `/invoices${query({ athlete_id: athleteId })}`
  );
  return data.items.map(toInvoice);
}

export async function listMyInvoices(): Promise<Invoice[]> {
  const data = await api.get<ListResponse<InvoiceRow>>("/invoices/mine");
  return data.items.map(toInvoice);
}

export async function createInvoice(input: {
  itemType: InvoiceItemType;
  itemId: string;
  amountToman: number;
}): Promise<{ id: string }> {
  return api.post<{ id: string }>("/invoices", {
    item_type: input.itemType,
    item_id: input.itemId,
    amount_toman: input.amountToman,
  });
}

export async function markInvoicePaid(input: {
  id: string;
  paymentMethod: ManualPaymentMethod;
  note?: string | null;
}): Promise<void> {
  await api.patch(`/invoices/${input.id}/mark-paid`, {
    payment_method: input.paymentMethod,
    note: input.note ?? null,
  });
}

export async function cancelInvoice(id: string): Promise<void> {
  await api.patch(`/invoices/${id}/cancel`);
}
