import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";
import { getServerAuthContext } from "@/features/authentication/services/auth-server";

export const metadata = { title: "پیشرفت | جیم‌لیک" };

export default async function ProgressPage() {
  const context = await getServerAuthContext();
  if (!context) redirect("/login");
  if (context.accountType !== "athlete") redirect("/dashboard");

  return (
    <ComingSoon
      icon={BarChart3}
      title="پیشرفت"
      description="نمودار روند قد، وزن و درصد چربی بدن به‌زودی در دسترس خواهد بود."
    />
  );
}
