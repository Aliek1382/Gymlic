import { z } from "zod";

export const addFoodSchema = z.object({
  name: z.string().trim().min(2, "نام غذا باید حداقل ۲ حرف باشد."),
  nameEn: z.string().trim().optional(),
  description: z.string().trim().optional(),
  category: z.string().trim().min(2, "دسته غذایی را وارد کنید."),
  defaultUnit: z.string().trim().min(1, "واحد پیش‌فرض را وارد کنید."),
});

export type AddFoodFormValues = z.infer<typeof addFoodSchema>;
