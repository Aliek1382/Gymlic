import { redirect } from "next/navigation";
import { Calendar } from "lucide-react";

import { ComingSoon } from "@/components/coming-soon";
import { getServerAuthContext } from "@/features/authentication/services/auth-server";

export const metadata = { title: "کلاس‌ها | جیم‌لیک" };

export default async function ClassesPage() {
  const context = await getServerAuthContext();
  if (!context) redirect("/login");
  if (context.accountType !== "club") redirect("/dashboard");

  return (
    <ComingSoon
      icon={Calendar}
      title="مدیریت کلاس‌ها"
      description="زمان‌بندی کلاس‌ها و پیگیری حضور و غیاب اعضا به‌زودی در دسترس خواهد بود."
    />
  );
}
