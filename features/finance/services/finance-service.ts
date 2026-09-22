import { api } from "@/lib/api/client";

export interface SubmitPaymentRequestInput {
  planId: string;
  amountToman: number;
  referenceNote?: string;
}

/** The club is resolved server-side from the caller's ownership. */
export async function submitPaymentRequest(input: SubmitPaymentRequestInput) {
  await api.post("/payment-requests", {
    plan_id: input.planId,
    amount_toman: input.amountToman,
    reference_note: input.referenceNote || null,
  });
}
