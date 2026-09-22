import { AuthSplitCard, LoginRedirectGuard } from "@/features/authentication";

export const metadata = { title: "ورود | جیم‌لیک" };

export default function LoginPage() {
  return (
    <>
      <LoginRedirectGuard />
      <AuthSplitCard />
    </>
  );
}
