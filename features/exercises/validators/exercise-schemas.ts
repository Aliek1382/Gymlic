import { z } from "zod";

export const addExerciseSchema = z.object({
  name: z.string().trim().min(2, "نام حرکت باید حداقل ۲ حرف باشد."),
  nameEn: z.string().trim().optional(),
  description: z.string().trim().optional(),
  muscleGroup: z.string().trim().min(2, "گروه عضلانی را وارد کنید."),
});

export type AddExerciseFormValues = z.infer<typeof addExerciseSchema>;
