import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";
import { getServerAuthContext } from "@/features/authentication/services/auth-server";

export const metadata = { title: "گزارش‌ها | جیم‌لیک" };

export default async function ReportsPage() {
  const context = await getServerAuthContext();
  if (!context) redirect("/login");
  if (context.accountType !== "trainer") redirect("/dashboard");

  return (
    <ComingSoon
      icon={BarChart3}
      title="گزارش‌ها"
      description="گزارش پیشرفت ورزشکاران و عملکرد برنامه‌ها به‌زودی در دسترس خواهد بود."
    />
  );
}
