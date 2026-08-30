import { z } from "zod";

export const adminProfileEditSchema = z.object({
  firstName: z.string().trim().min(2, "نام باید حداقل ۲ حرف باشد."),
  lastName: z.string().trim().min(1, "نام خانوادگی را وارد کنید."),
  email: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || z.string().email().safeParse(value).success, {
      message: "ایمیل معتبر نیست.",
    }),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^0?9\d{9}$/.test(value), {
      message: "شماره موبایل معتبر نیست.",
    }),
  birthDate: z.string().nullable().optional(),
});

export type AdminProfileEditFormValues = z.infer<typeof adminProfileEditSchema>;

export const planFormSchema = z.object({
  name: z.string().trim().min(2, "نام پلن را وارد کنید."),
  priceToman: z.coerce.number().int().min(0, "مبلغ نمی‌تواند منفی باشد."),
  durationDays: z.coerce.number().int().min(1, "مدت باید حداقل ۱ روز باشد."),
});

// Two shapes: the raw pre-coercion form input (numeric fields typed
// unknown, since z.coerce accepts anything) and the coerced output onSubmit
// actually receives — useForm's third generic wires the resolver's output
// to the submit handler while defaultValues/register keep using the input.
export type PlanFormInput = z.input<typeof planFormSchema>;
export type PlanFormValues = z.output<typeof planFormSchema>;
