import { z } from "zod";

export const addSupplementSchema = z.object({
  name: z.string().trim().min(2, "نام مکمل باید حداقل ۲ حرف باشد."),
  nameEn: z.string().trim().optional(),
  description: z.string().trim().optional(),
});

export type AddSupplementFormValues = z.infer<typeof addSupplementSchema>;
