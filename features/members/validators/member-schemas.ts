import { z } from "zod";

import { PLAN_TIER_VALUES, MEMBER_STATUS_VALUES } from "../constants/members";

const planTierSchema = z.enum(PLAN_TIER_VALUES, "طرح عضویت را انتخاب کنید.");

const statusSchema = z.enum(MEMBER_STATUS_VALUES, "وضعیت عضویت را انتخاب کنید.");

export const addMemberSchema = z.object({
  firstName: z.string().trim().min(2, "نام باید حداقل ۲ حرف باشد."),
  lastName: z.string().trim().min(1, "نام خانوادگی را وارد کنید."),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^09\d{9}$/.test(value), {
      message: "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.",
    }),
  planTier: planTierSchema,
  // "" = no trainer picked; Radix Select cannot hold an empty value, so the
  // form uses NO_TRAINER_VALUE and maps it back to null on submit.
  trainerId: z.string().optional(),
});

export type AddMemberFormValues = z.infer<typeof addMemberSchema>;

export const editMemberSchema = z.object({
  planTier: planTierSchema,
  status: statusSchema,
});

export type EditMemberFormValues = z.infer<typeof editMemberSchema>;
