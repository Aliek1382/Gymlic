import { AuthShell, LoginForm } from "@/features/authentication";

export const metadata = { title: "ورود | جیم‌لیک" };

export default function LoginPage() {
  return (
    <AuthShell
      title="ورود به جیم‌لیک"
      description="با موبایل، ایمیل یا رمز عبور وارد جیم‌لیک شوید."
    >
      <LoginForm />
    </AuthShell>
  );
}
