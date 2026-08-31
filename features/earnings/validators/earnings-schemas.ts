import { z } from "zod";

import { toAsciiDigits } from "@/lib/persian";

/**
 * Amounts get typed on a Persian keyboard and are often grouped with a
 * separator ("۲٬۵۰۰٬۰۰۰"), so normalize both before validating or parsing —
 * the field accepts what the trainer naturally types.
 */
export function normalizeAmount(value: string): string {
  return toAsciiDigits(value).replace(/[,٬\s]/g, "");
}

export const trainerPaymentFormSchema = z.object({
  athleteId: z.string().min(1, "شاگرد را انتخاب کنید."),
  amountToman: z
    .string()
    .trim()
    .min(1, "مبلغ را وارد کنید.")
    .refine((value) => /^\d+$/.test(normalizeAmount(value)), {
      message: "مبلغ را فقط با عدد وارد کنید.",
    })
    .refine((value) => Number(normalizeAmount(value)) > 0, {
      message: "مبلغ باید بزرگ‌تر از صفر باشد.",
    }),
  paidAt: z.string().min(1, "تاریخ پرداخت را انتخاب کنید."),
  note: z.string().trim().optional(),
});

export type TrainerPaymentFormValues = z.infer<typeof trainerPaymentFormSchema>;
