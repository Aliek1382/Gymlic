import { redirect } from "next/navigation";
import { Apple } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";
import { getServerAuthContext } from "@/features/authentication/services/auth-server";

export const metadata = { title: "برنامه غذایی | جیم‌لیک" };

export default async function NutritionPage() {
  const context = await getServerAuthContext();
  if (!context) redirect("/login");
  if (context.accountType !== "athlete") redirect("/dashboard");

  return (
    <ComingSoon
      icon={Apple}
      title="برنامه غذایی"
      description="مشاهده کامل برنامه غذایی و وعده‌های روزانه به‌زودی در دسترس خواهد بود."
    />
  );
}
