import {
  AthleteProgressList,
  TrainerCompletionRates,
  TrainerMonthlyStats,
  TrainerWeeklyAdherence,
  ReportExcelButton,
  ReportSection,
} from "@/features/reports";
import { RoleGate } from "@/features/authentication/components/role-gate";

export const metadata = { title: "گزارش‌ها | جیم‌لیک" };

export default function ReportsPage() {
  return (
    <RoleGate allow={["trainer"]}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">گزارش‌ها</h1>
            <p className="text-sm text-muted-foreground">
              آمار کلی فعالیت شما و روند پیشرفت ورزشکاران را اینجا ببینید.
            </p>
          </div>
          <ReportExcelButton />
        </div>

        <TrainerMonthlyStats />
        {/* Each section needs a report level of the trainer's plan; the server refuses it otherwise. */}
        <ReportSection title="نرخ تکمیل" need="basic">
          <TrainerCompletionRates />
        </ReportSection>
        <ReportSection title="پایبندی هفتگی" need="full">
          <TrainerWeeklyAdherence />
        </ReportSection>
        <ReportSection title="پیشرفت ورزشکاران" need="basic">
          <AthleteProgressList />
        </ReportSection>
      </div>
    </RoleGate>
  );
}
