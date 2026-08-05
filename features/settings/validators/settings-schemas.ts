import { z } from "zod";

export const profileInfoSchema = z.object({
  firstName: z.string().trim().min(2, "نام باید حداقل ۲ حرف باشد."),
  lastName: z.string().trim().min(1, "نام خانوادگی را وارد کنید."),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^0?9\d{9}$/.test(value), {
      message: "شماره موبایل معتبر نیست.",
    }),
});

export type ProfileInfoFormValues = z.infer<typeof profileInfoSchema>;

export const emailFormSchema = z.object({
  email: z.string().trim().email("ایمیل معتبر نیست."),
});

export type EmailFormValues = z.infer<typeof emailFormSchema>;

export const passwordFormSchema = z
  .object({
    newPassword: z.string().min(6, "رمز عبور باید حداقل ۶ کاراکتر باشد."),
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "رمز عبور و تکرار آن یکسان نیستند.",
    path: ["confirmPassword"],
  });

export type PasswordFormValues = z.infer<typeof passwordFormSchema>;
