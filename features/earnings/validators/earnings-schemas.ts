import { z } from "zod";

import { normalizeAmount } from "@/lib/persian";

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
