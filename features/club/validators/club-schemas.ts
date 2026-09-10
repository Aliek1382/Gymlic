import { z } from "zod";

import { normalizeAmount, toAsciiDigits } from "@/lib/persian";

export const clubProfileSchema = z.object({
  name: z.string().trim().min(2, "نام باشگاه باید حداقل ۲ حرف باشد."),
  address: z.string().trim().optional(),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^\d{8,11}$/.test(toAsciiDigits(value)), {
      message: "شماره تماس را فقط با عدد و بین ۸ تا ۱۱ رقم وارد کنید.",
    }),
  workingHours: z.string().trim().optional(),
});

export type ClubProfileFormValues = z.infer<typeof clubProfileSchema>;

export const membershipPlanSchema = z.object({
  name: z.string().trim().min(2, "نام طرح باید حداقل ۲ حرف باشد."),
  priceToman: z
    .string()
    .trim()
    .min(1, "قیمت را وارد کنید.")
    .refine((value) => /^\d+$/.test(normalizeAmount(value)), {
      message: "قیمت را فقط با عدد وارد کنید.",
    }),
  durationDays: z
    .string()
    .trim()
    .min(1, "مدت طرح را وارد کنید.")
    .refine((value) => /^\d+$/.test(toAsciiDigits(value)), {
      message: "مدت را فقط با عدد (روز) وارد کنید.",
    })
    .refine((value) => Number(toAsciiDigits(value)) > 0, {
      message: "مدت طرح باید حداقل ۱ روز باشد.",
    }),
  description: z.string().trim().optional(),
  isActive: z.boolean(),
});

export type MembershipPlanFormValues = z.infer<typeof membershipPlanSchema>;
