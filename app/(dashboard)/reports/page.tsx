import { redirect } from "next/navigation";

import { getServerAuthContext } from "@/features/authentication/services/auth-server";
import {
  AthleteProgressList,
  TrainerCompletionRates,
  TrainerMonthlyStats,
  TrainerWeeklyAdherence,
} from "@/features/reports";

export const metadata = { title: "گزارش‌ها | جیم‌لیک" };

export default async function ReportsPage() {
  const context = await getServerAuthContext();
  if (!context) redirect("/login");
  if (context.accountType !== "trainer") redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">گزارش‌ها</h1>
        <p className="text-sm text-muted-foreground">
          آمار کلی فعالیت شما و روند پیشرفت ورزشکاران را اینجا ببینید.
        </p>
      </div>

      <TrainerMonthlyStats />
      <TrainerCompletionRates />
      <TrainerWeeklyAdherence />
      <AthleteProgressList />
    </div>
  );
}
