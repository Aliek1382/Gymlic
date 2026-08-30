import { z } from "zod";

export const paymentRequestFormSchema = z.object({
  planId: z.string().min(1, "یک پلن را انتخاب کنید."),
  amountToman: z.coerce.number().int().min(1, "مبلغ را وارد کنید."),
  referenceNote: z.string().trim().optional(),
});

// Two shapes: the raw pre-coercion form input (amountToman typed unknown,
// since z.coerce accepts anything) and the coerced output onSubmit
// actually receives — see the matching note in admin-schemas.ts.
export type PaymentRequestFormInput = z.input<typeof paymentRequestFormSchema>;
export type PaymentRequestFormValues = z.output<typeof paymentRequestFormSchema>;
