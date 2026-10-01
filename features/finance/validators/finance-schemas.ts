import { z } from "zod";

export const paymentRequestFormSchema = z.object({
  planId: z.string().min(1, "یک پلن را انتخاب کنید."),
  // 0 passes here only for a discount code that covers the whole price; the
  // dialog checks that, since the schema can't see the code.
  amountToman: z.coerce.number().int().min(0, "مبلغ را وارد کنید."),
  referenceNote: z.string().trim().optional(),
});

// Two shapes: the raw pre-coercion form input (amountToman typed unknown,
// since z.coerce accepts anything) and the coerced output onSubmit
// actually receives — see the matching note in admin-schemas.ts.
export type PaymentRequestFormInput = z.input<typeof paymentRequestFormSchema>;
export type PaymentRequestFormValues = z.output<typeof paymentRequestFormSchema>;
