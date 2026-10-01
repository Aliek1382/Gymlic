import { api, query, type ListResponse } from "@/lib/api/client";
import type {
  ClaimStatus,
  Invoice,
  InvoiceClaim,
  InvoicePayTo,
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
  claim?: ClaimRow | null;
  pay_to?: PayToRow | null;
}

interface ClaimRow {
  id: string;
  status: ClaimStatus;
  tracking_code: string;
  card_last4: string;
  paid_at: string | null;
  note: string | null;
  trainer_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  has_receipt: boolean;
  receipt_is_pdf: boolean;
  receipt_purged_at: string | null;
  duplicate_tracking: boolean;
}

interface PayToRow {
  trainer_name: string;
  card_number: string;
  sheba: string;
  holder_name: string;
  bank_name: string;
}

function toClaim(row: ClaimRow | null | undefined): InvoiceClaim | null {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    trackingCode: row.tracking_code,
    cardLast4: row.card_last4,
    paidAt: row.paid_at,
    note: row.note,
    trainerNote: row.trainer_note,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    hasReceipt: row.has_receipt,
    receiptIsPdf: row.receipt_is_pdf,
    receiptPurged: row.receipt_purged_at !== null,
    duplicateTracking: row.duplicate_tracking,
  };
}

function toPayTo(row: PayToRow | null | undefined): InvoicePayTo | null {
  if (!row) return null;
  return {
    trainerName: row.trainer_name,
    cardNumber: row.card_number,
    sheba: row.sheba,
    holderName: row.holder_name,
    bankName: row.bank_name,
  };
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
    claim: toClaim(row.claim),
    payTo: toPayTo(row.pay_to),
  };
}

/** The trainer's invoices — one athlete's, or all of them when no id is given. */
export async function listInvoices(athleteId?: string): Promise<Invoice[]> {
  const data = await api.get<ListResponse<InvoiceRow>>(
    `/invoices${query({ athlete_id: athleteId })}`
  );
  return data.items.map(toInvoice);
}

/** The athlete's invoices; claimsEnabled is false until the server has the "I paid" tables. */
export async function listMyInvoices(): Promise<{ invoices: Invoice[]; claimsEnabled: boolean }> {
  const data = await api.get<ListResponse<InvoiceRow> & { claims_enabled?: boolean }>("/invoices/mine");
  return { invoices: data.items.map(toInvoice), claimsEnabled: data.claims_enabled === true };
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

/** The athlete says they paid: tracking code, last four digits and (usually) a receipt. */
export async function submitInvoiceClaim(input: {
  invoiceId: string;
  trackingCode: string;
  cardLast4: string;
  paidAt?: string;
  note?: string;
  receipt?: File | null;
}): Promise<void> {
  const fields: Record<string, string> = {
    tracking_code: input.trackingCode,
    card_last4: input.cardLast4,
  };
  if (input.paidAt) fields.paid_at = input.paidAt;
  if (input.note) fields.note = input.note;

  const path = `/invoices/${input.invoiceId}/claim`;
  if (input.receipt) {
    await api.upload(path, input.receipt, fields, "receipt");
  } else {
    await api.post(path, fields);
  }
}

/** The money arrived: settles the invoice and opens the plan for the athlete. */
export async function approveInvoiceClaim(invoiceId: string): Promise<void> {
  await api.post(`/invoices/${invoiceId}/claim/approve`);
}

export async function rejectInvoiceClaim(invoiceId: string, note?: string): Promise<void> {
  await api.post(`/invoices/${invoiceId}/claim/reject`, { note: note || null });
}

// ---------------------------------------------------------------------------
// The trainer's receiving card
// ---------------------------------------------------------------------------

export interface TrainerPaymentInfo {
  card_number: string;
  sheba: string;
  holder_name: string;
  bank_name: string;
}

export async function getTrainerPaymentInfo(): Promise<{ ready: boolean; info: TrainerPaymentInfo }> {
  return api.get("/payment-info");
}

export async function saveTrainerPaymentInfo(info: TrainerPaymentInfo): Promise<void> {
  await api.put("/payment-info", info);
}
