import { redirect } from "next/navigation";
import { Dumbbell } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";
import { getServerAuthContext } from "@/features/authentication/services/auth-server";

export const metadata = { title: "برنامه‌های تمرینی | جیم‌لیک" };

export default async function WorkoutProgramsPage() {
  const context = await getServerAuthContext();
  if (!context) redirect("/login");
  if (context.accountType !== "trainer") redirect("/dashboard");

  return (
    <ComingSoon
      icon={Dumbbell}
      title="برنامه‌های تمرینی"
      description="ساخت و تخصیص برنامه تمرینی به ورزشکاران به‌زودی در دسترس خواهد بود."
    />
  );
}
