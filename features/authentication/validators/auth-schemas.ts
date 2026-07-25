import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "ایمیل را وارد کنید.")
    .email("ایمیل معتبر نیست."),
  password: z.string().min(1, "رمز عبور را وارد کنید."),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const signUpSchema = z.object({
  name: z.string().trim().min(2, "نام باید حداقل ۲ حرف باشد."),
  email: z
    .string()
    .trim()
    .min(1, "ایمیل را وارد کنید.")
    .email("ایمیل معتبر نیست."),
  password: z.string().min(6, "رمز عبور باید حداقل ۶ کاراکتر باشد."),
});

export type SignUpFormValues = z.infer<typeof signUpSchema>;

export const joinSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "ایمیل را وارد کنید.")
    .email("ایمیل معتبر نیست."),
  password: z.string().min(6, "رمز عبور باید حداقل ۶ کاراکتر باشد."),
});

export type JoinFormValues = z.infer<typeof joinSchema>;

export const roleSchema = z.object({
  role: z.enum(["club", "trainer", "athlete"], {
    message: "یک نقش را انتخاب کنید.",
  }),
});

export type RoleFormValues = z.infer<typeof roleSchema>;

export const createClubSchema = z.object({
  name: z.string().trim().min(2, "نام باشگاه باید حداقل ۲ حرف باشد."),
});

export type CreateClubFormValues = z.infer<typeof createClubSchema>;

export const invitationSchema = z.object({
  code: z.string().trim().min(4, "کد دعوت معتبر نیست."),
});

export type InvitationFormValues = z.infer<typeof invitationSchema>;
