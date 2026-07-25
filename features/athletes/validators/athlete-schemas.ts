import { z } from "zod";

const optionalNumericString = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || /^\d+(\.\d+)?$/.test(value), {
    message: "فقط عدد وارد کنید.",
  });

export const addAthleteSchema = z.object({
  firstName: z.string().trim().min(2, "نام باید حداقل ۲ حرف باشد."),
  lastName: z.string().trim().min(1, "نام خانوادگی را وارد کنید."),
  heightCm: optionalNumericString,
  weightKg: optionalNumericString,
});

export type AddAthleteFormValues = z.infer<typeof addAthleteSchema>;

export const planSchema = z.object({
  title: z.string().trim().min(2, "عنوان باید حداقل ۲ حرف باشد."),
  description: z.string().trim().optional(),
});

export type PlanFormValues = z.infer<typeof planSchema>;
