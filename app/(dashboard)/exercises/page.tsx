import { redirect } from "next/navigation";
import { LineChart } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";
import { getServerAuthContext } from "@/features/authentication/services/auth-server";

export const metadata = { title: "کتابخانه حرکات | جیم‌لیک" };

export default async function ExercisesPage() {
  const context = await getServerAuthContext();
  if (!context) redirect("/login");
  if (context.accountType !== "trainer") redirect("/dashboard");

  return (
    <ComingSoon
      icon={LineChart}
      title="کتابخانه حرکات"
      description="مجموعه حرکات تمرینی برای استفاده در برنامه‌های تمرینی به‌زودی در دسترس خواهد بود."
    />
  );
}
