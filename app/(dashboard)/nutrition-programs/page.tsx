import { redirect } from "next/navigation";
import { Apple } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";
import { getServerAuthContext } from "@/features/authentication/services/auth-server";

export const metadata = { title: "برنامه‌های غذایی | جیم‌لیک" };

export default async function NutritionProgramsPage() {
  const context = await getServerAuthContext();
  if (!context) redirect("/login");
  if (context.accountType !== "trainer") redirect("/dashboard");

  return (
    <ComingSoon
      icon={Apple}
      title="برنامه‌های غذایی"
      description="ساخت و تخصیص برنامه غذایی به ورزشکاران به‌زودی در دسترس خواهد بود."
    />
  );
}
