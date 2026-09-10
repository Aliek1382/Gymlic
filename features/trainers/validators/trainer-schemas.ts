import { z } from "zod";

export const addTrainerSchema = z.object({
  firstName: z.string().trim().min(2, "نام باید حداقل ۲ حرف باشد."),
  lastName: z.string().trim().min(1, "نام خانوادگی را وارد کنید."),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^09\d{9}$/.test(value), {
      message: "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.",
    }),
});

export type AddTrainerFormValues = z.infer<typeof addTrainerSchema>;
