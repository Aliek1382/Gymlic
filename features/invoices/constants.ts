import type { InvoiceItemType, InvoicePaymentMethod, InvoiceStatus } from "./types/invoice-types";

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

export const INVOICE_ITEM_LABEL: Record<InvoiceItemType, string> = {
  workout_plan: "تمرینی",
  nutrition_plan: "غذایی",
  session_package: "پکیج جلسه",
};
