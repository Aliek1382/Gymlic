import { redirect } from "next/navigation";
import { Users } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";
import { getServerAuthContext } from "@/features/authentication/services/auth-server";

export const metadata = { title: "ورزشکاران | جیم‌لیک" };

export default async function AthletesPage() {
  const context = await getServerAuthContext();
  if (!context) redirect("/login");
  if (context.accountType !== "trainer") redirect("/dashboard");

  return (
    <ComingSoon
      icon={Users}
      title="مدیریت ورزشکاران"
      description="لیست ورزشکاران، دعوت شاگرد جدید و پیگیری وضعیت آن‌ها به‌زودی در دسترس خواهد بود."
    />
  );
}
