import { z } from "zod";

import { normalizeAmount } from "@/lib/persian";
import { REVENUE_CATEGORY_VALUES } from "../constants/revenue";

export const revenueEntryFormSchema = z.object({
  // "" (NO_MEMBER_VALUE) is valid: income that belongs to no member, such
  // as a walk-in product sale.
  memberId: z.string().optional(),
  amount: z
    .string()
    .trim()
    .min(1, "مبلغ را وارد کنید.")
    .refine((value) => /^\d+$/.test(normalizeAmount(value)), {
      message: "مبلغ را فقط با عدد وارد کنید.",
    })
    .refine((value) => Number(normalizeAmount(value)) > 0, {
      message: "مبلغ باید بزرگ‌تر از صفر باشد.",
    }),
  category: z.enum(REVENUE_CATEGORY_VALUES, "نوع درآمد را انتخاب کنید."),
  occurredOn: z.string().min(1, "تاریخ دریافت را انتخاب کنید."),
  note: z.string().trim().optional(),
});

export type RevenueEntryFormValues = z.infer<typeof revenueEntryFormSchema>;
