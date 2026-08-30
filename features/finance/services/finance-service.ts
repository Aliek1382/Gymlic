import { createClient } from "@/lib/supabase/client";

export interface SubmitPaymentRequestInput {
  planId: string;
  amountToman: number;
  referenceNote?: string;
}

export async function submitPaymentRequest(input: SubmitPaymentRequestInput) {
  const supabase = createClient();
  const { error } = await supabase.rpc("submit_payment_request", {
    p_plan_id: input.planId,
    p_amount_toman: input.amountToman,
    p_reference_note: input.referenceNote || null,
  });
  if (error) throw error;
}
