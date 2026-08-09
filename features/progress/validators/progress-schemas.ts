import { z } from "zod";

const optionalNumericString = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || /^\d+(\.\d+)?$/.test(value), {
    message: "فقط عدد وارد کنید.",
  });

export const measurementFormSchema = z
  .object({
    heightCm: optionalNumericString,
    weightKg: optionalNumericString,
    bodyFatPercent: optionalNumericString,
    waistCm: optionalNumericString,
    chestCm: optionalNumericString,
    note: z.string().trim().optional(),
  })
  .refine(
    (values) =>
      Boolean(
        values.heightCm ||
          values.weightKg ||
          values.bodyFatPercent ||
          values.waistCm ||
          values.chestCm
      ),
    {
      message: "حداقل یک مقدار (قد، وزن، درصد چربی، دور کمر یا دور سینه) را وارد کنید.",
      path: ["weightKg"],
    }
  );

export type MeasurementFormValues = z.infer<typeof measurementFormSchema>;
