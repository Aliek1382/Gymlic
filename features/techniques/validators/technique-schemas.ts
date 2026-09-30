import { z } from "zod";

export const addTechniqueSchema = z.object({
  name: z.string().trim().min(2, "نام تکنیک باید حداقل ۲ حرف باشد.").max(255),
  description: z.string().trim().optional(),
});

export type AddTechniqueFormValues = z.infer<typeof addTechniqueSchema>;
