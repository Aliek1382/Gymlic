import { z } from "zod";

import { parseLocaleNumber } from "@/lib/persian";

// Optional numeric field kept as text in the form, so a half-typed value or
// a Persian-digit entry doesn't fight the input. The ceilings match the
// DECIMAL columns behind them (calories 7,2 / grams 6,2).
function optionalNumber(max: number, message: string) {
  return z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => {
        if (!value) return true;
        const parsed = parseLocaleNumber(value);
        return parsed !== null && parsed >= 0 && parsed <= max;
      },
      { message }
    );
}

export const addFoodSchema = z.object({
  name: z.string().trim().min(2, "نام غذا باید حداقل ۲ حرف باشد."),
  nameEn: z.string().trim().optional(),
  description: z.string().trim().optional(),
  category: z.string().trim().min(2, "دسته غذایی را وارد کنید."),
  defaultUnit: z.string().trim().min(1, "واحد پیش‌فرض را وارد کنید."),
  caloriesPerUnit: optionalNumber(99999.99, "کالری باید عددی بین ۰ تا ۹۹٬۹۹۹ باشد."),
  proteinG: optionalNumber(9999.99, "پروتئین باید عددی بین ۰ تا ۹٬۹۹۹ باشد."),
  carbsG: optionalNumber(9999.99, "کربوهیدرات باید عددی بین ۰ تا ۹٬۹۹۹ باشد."),
  fatG: optionalNumber(9999.99, "چربی باید عددی بین ۰ تا ۹٬۹۹۹ باشد."),
});

export type AddFoodFormValues = z.infer<typeof addFoodSchema>;
