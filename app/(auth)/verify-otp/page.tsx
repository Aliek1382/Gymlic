import { redirect } from "next/navigation";

import { AuthShell, OtpVerificationForm } from "@/features/authentication";
import type { OtpMethod } from "@/features/authentication/services/auth-service";

export const metadata = { title: "تایید کد | جیم‌لیک" };

export default async function VerifyOtpPage({
  searchParams,
}: {
  searchParams: Promise<{ method?: string; value?: string }>;
}) {
  const { method, value } = await searchParams;

  if (!value || (method !== "phone" && method !== "email")) {
    redirect("/login");
  }

  return (
    <AuthShell
      title={method === "phone" ? "تایید شماره موبایل" : "تایید ایمیل"}
      description="کد ۶ رقمی ارسال شده را وارد کنید."
    >
      <OtpVerificationForm method={method as OtpMethod} value={value} />
    </AuthShell>
  );
}
