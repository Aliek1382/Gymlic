import { redirect } from "next/navigation";

import { getServerAuthContext } from "@/features/authentication/services/auth-server";
import { PlanBrowser } from "@/features/athletes";

export const metadata = { title: "برنامه‌های تمرینی | جیم‌لیک" };

export default async function WorkoutProgramsPage() {
  const context = await getServerAuthContext();
  if (!context) redirect("/login");
  if (context.accountType !== "trainer") redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">برنامه‌های تمرینی</h1>
        <p className="text-sm text-muted-foreground">
          یک ورزشکار را انتخاب کنید تا همه برنامه‌های تمرینی ثبت‌شده برای او
          را ببینید.
        </p>
      </div>

      <PlanBrowser kind="workout" />
    </div>
  );
}
