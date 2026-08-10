import { z } from "zod";

export const broadcastNotificationSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "عنوان باید حداقل ۳ حرف باشد.")
    .max(120, "عنوان بیش از حد طولانی است."),
  body: z.string().trim().max(500, "متن بیش از حد طولانی است.").optional(),
  link: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || value.startsWith("/"), {
      message: "لینک باید یک مسیر داخلی باشد و با / شروع شود.",
    }),
});

export type BroadcastNotificationFormValues = z.infer<typeof broadcastNotificationSchema>;
