import { z } from "zod";

import { MEMBER_STATUS_VALUES } from "../constants/members";

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
  // NO_PLAN_VALUE when the club has no plan for this member yet.
  planId: z.string().optional(),
  // "" = no trainer picked; Radix Select cannot hold an empty value, so the
  // form uses NO_TRAINER_VALUE and maps it back to null on submit.
  trainerId: z.string().optional(),
});

export type AddMemberFormValues = z.infer<typeof addMemberSchema>;

export const editMemberSchema = z.object({
  planId: z.string().optional(),
  status: statusSchema,
  hasEndDate: z.boolean(),
  expiresAt: z.string(),
});

export type EditMemberFormValues = z.infer<typeof editMemberSchema>;
