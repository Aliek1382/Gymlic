import type { InvoicePaymentMethod, InvoiceStatus } from "./types/invoice-types";

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  pending: "در انتظار پرداخت",
  paid: "پرداخت‌شده",
  cancelled: "لغو‌شده",
};

export const PAYMENT_METHOD_LABEL: Record<InvoicePaymentMethod, string> = {
  cash: "نقدی",
  card_transfer: "کارت‌به‌کارت",
  online: "آنلاین",
};
