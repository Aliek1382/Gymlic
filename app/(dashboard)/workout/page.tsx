import { redirect } from "next/navigation";
import { Dumbbell } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";
import { getServerAuthContext } from "@/features/authentication/services/auth-server";

export const metadata = { title: "برنامه تمرینی | جیم‌لیک" };

export default async function WorkoutPage() {
  const context = await getServerAuthContext();
  if (!context) redirect("/login");
  if (context.accountType !== "athlete") redirect("/dashboard");

  return (
    <ComingSoon
      icon={Dumbbell}
      title="برنامه تمرینی"
      description="مشاهده کامل برنامه تمرینی و ثبت پیشرفت هر جلسه به‌زودی در دسترس خواهد بود."
    />
  );
}
