import { z } from "zod";

import { IRAN_MOBILE_REGEX, OTP_LENGTH } from "../constants/auth";

export const phoneSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(1, "شماره موبایل را وارد کنید.")
    .regex(IRAN_MOBILE_REGEX, "شماره موبایل معتبر نیست. مثال: 09123456789"),
});

export type PhoneFormValues = z.infer<typeof phoneSchema>;

export const otpSchema = z.object({
  code: z
    .string()
    .trim()
    .length(OTP_LENGTH, `کد تایید باید ${OTP_LENGTH} رقم باشد.`),
});

export type OtpFormValues = z.infer<typeof otpSchema>;

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

export function normalizeIranPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("98")
    ? digits.slice(2)
    : digits.replace(/^0/, "");
  return `+98${local}`;
}
