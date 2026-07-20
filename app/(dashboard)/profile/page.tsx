import { redirect } from "next/navigation";
import { UserCircle } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";
import { getServerAuthContext } from "@/features/authentication/services/auth-server";

export const metadata = { title: "پروفایل | جیم‌لیک" };

export default async function ProfilePage() {
  const context = await getServerAuthContext();
  if (!context) redirect("/login");
  if (context.accountType !== "athlete") redirect("/dashboard");

  return (
    <ComingSoon
      icon={UserCircle}
      title="پروفایل"
      description="ویرایش اطلاعات فردی و مدیریت حساب کاربری به‌زودی در دسترس خواهد بود."
    />
  );
}
