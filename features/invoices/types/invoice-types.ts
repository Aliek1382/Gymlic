export type InvoiceItemType = "workout_plan" | "nutrition_plan";
export type InvoiceStatus = "pending" | "paid" | "cancelled";
// 'online' is reserved for a future payment gateway; nothing writes it yet.
export type InvoicePaymentMethod = "cash" | "card_transfer" | "online";
export type ManualPaymentMethod = Exclude<InvoicePaymentMethod, "online">;

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
}

/** What a locked plan carries in place of its content. */
export interface PlanInvoiceSummary {
  id: string;
  number: string;
  amountToman: number;
}
