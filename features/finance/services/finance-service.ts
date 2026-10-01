import { api } from "@/lib/api/client";

export interface SubmitPaymentRequestInput {
  planId: string;
  amountToman: number;
  referenceNote?: string;
  discountCode?: string;
}

/** The club is resolved server-side from the caller's ownership. */
export async function submitPaymentRequest(input: SubmitPaymentRequestInput) {
  await api.post("/payment-requests", {
    plan_id: input.planId,
    amount_toman: input.amountToman,
    reference_note: input.referenceNote || null,
    discount_code: input.discountCode || null,
  });
}

export interface PaymentInfo {
  card_number: string;
  sheba: string;
  account_holder: string;
  bank_name: string;
  instructions: string;
}

export interface BillingInfo {
  payment: PaymentInfo;
  /** False until the database has the discount-code tables. */
  discounts_enabled: boolean;
}

/** Never throws: an older backend without it just shows no payment details. */
export async function getBillingInfo(): Promise<BillingInfo | null> {
  try {
    return await api.get<BillingInfo>("/billing/info");
  } catch {
    return null;
  }
}

export interface DiscountQuote {
  code: string;
  list_price_toman: number;
  discount_toman: number;
  final_toman: number;
}

export async function checkDiscountCode(planId: string, code: string): Promise<DiscountQuote> {
  return api.post<DiscountQuote>("/billing/discount-check", { plan_id: planId, code });
}
