import { redirect } from "next/navigation";

import { AuthShell, OtpVerificationForm } from "@/features/authentication";

export const metadata = { title: "تایید کد | جیم‌لیک" };

export default async function VerifyOtpPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string }>;
}) {
  const { phone } = await searchParams;

  if (!phone) redirect("/login");

  return (
    <AuthShell
      title="تایید شماره موبایل"
      description="کد ۶ رقمی ارسال شده را وارد کنید."
    >
      <OtpVerificationForm phone={phone} />
    </AuthShell>
  );
}
