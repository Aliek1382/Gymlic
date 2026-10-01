export type InvoiceItemType = "workout_plan" | "nutrition_plan" | "session_package" | "questionnaire";
export type InvoiceStatus = "pending" | "paid" | "cancelled";
// 'online' is reserved for a future payment gateway; nothing writes it yet.
export type InvoicePaymentMethod = "cash" | "card_transfer" | "online";
export type ManualPaymentMethod = Exclude<InvoicePaymentMethod, "online">;

export type ClaimStatus = "pending" | "approved" | "rejected";

/** An athlete's "I paid" against an invoice. */
export interface InvoiceClaim {
  id: string;
  status: ClaimStatus;
  trackingCode: string;
  cardLast4: string;
  paidAt: string | null;
  note: string | null;
  trainerNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  hasReceipt: boolean;
  receiptIsPdf: boolean;
  /** The receipt file was deleted after the retention period. */
  receiptPurged: boolean;
  /** Another claim to the same trainer used this tracking code (trainer's view). */
  duplicateTracking: boolean;
  /** The trainer's discount code the athlete paid with, and what it took off. */
  discountCode: string | null;
  listPriceToman: number | null;
  discountToman: number;
}

/** The trainer's receiving account, as the athlete sees it on a pending invoice. */
export interface InvoicePayTo {
  trainerName: string;
  cardNumber: string;
  sheba: string;
  holderName: string;
  bankName: string;
}

export interface Invoice {
  id: string;
  number: string;
  athleteId: string;
  athleteName: string;
  itemType: InvoiceItemType;
  itemId: string;
  itemTitle: string | null;
  amountToman: number;
  status: InvoiceStatus;
  paymentMethod: InvoicePaymentMethod | null;
  note: string | null;
  paidAt: string | null;
  createdAt: string;
  /** The latest claim the athlete filed, if any. */
  claim: InvoiceClaim | null;
  /** Athlete's side only, while the invoice is pending. */
  payTo: InvoicePayTo | null;
}

/** What a locked plan carries in place of its content. */
export interface PlanInvoiceSummary {
  id: string;
  number: string;
  amountToman: number;
}
