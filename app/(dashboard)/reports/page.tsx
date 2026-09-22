import {
  AthleteProgressList,
  TrainerCompletionRates,
  TrainerMonthlyStats,
  TrainerWeeklyAdherence,
} from "@/features/reports";
import { RoleGate } from "@/features/authentication/components/role-gate";

export const metadata = { title: "گزارش‌ها | جیم‌لیک" };

export default function ReportsPage() {
  return (
    <RoleGate allow={["trainer"]}>
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
    </RoleGate>
  );
}
