import { AuthShell, LoginForm } from "@/features/authentication";

export const metadata = { title: "ورود | جیم‌لیک" };

export default function LoginPage() {
  return (
    <AuthShell
      title="ورود به جیم‌لیک"
      description="با موبایل یا ایمیل وارد شوید تا کد تایید برایتان ارسال شود."
    >
      <LoginForm />
    </AuthShell>
  );
}
