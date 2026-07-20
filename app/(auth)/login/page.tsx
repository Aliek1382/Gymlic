import { AuthShell, PhoneLoginForm } from "@/features/authentication";

export const metadata = { title: "ورود | جیم‌لیک" };

export default function LoginPage() {
  return (
    <AuthShell
      title="ورود به جیم‌لیک"
      description="شماره موبایل خود را وارد کنید تا کد تایید برایتان پیامک شود."
    >
      <PhoneLoginForm />
    </AuthShell>
  );
}
