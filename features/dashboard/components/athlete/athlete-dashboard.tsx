"use client";

import { Apple, Dumbbell, PauseCircle } from "lucide-react";

import { CoachMessageCard } from "@/features/messages";
import { ProgressDashboardWidget } from "@/features/progress";
import { useFeatureCheck } from "@/features/site-settings";
import { useAthleteDashboard } from "../../hooks/use-athlete-dashboard";
import { WelcomeSection } from "../shared/welcome-section";
import { DashboardSkeleton } from "../shared/dashboard-skeleton";
import { ErrorState } from "../shared/error-state";
import { PlanSummaryCard } from "./plan-summary-card";
import { StreakCard } from "./streak-card";

export function AthleteDashboard({
  athleteId,
  athleteName,
  trainerName,
}: {
  athleteId: string;
  athleteName: string;
  trainerName: string | null;
}) {
  const dashboard = useAthleteDashboard(athleteId);
  const isEnabled = useFeatureCheck();

  if (dashboard.isLoading) {
    return <DashboardSkeleton />;
  }

  if (dashboard.isError || !dashboard.data) {
    return <ErrorState message="بارگذاری اطلاعات داشبورد با خطا مواجه شد." />;
  }

  return (
    <div className="space-y-6">
      <WelcomeSection
        name={athleteName}
        subtitle="برنامه امروز و پیشرفت خودت را اینجا ببین."
        trainerName={trainerName}
      />

      {dashboard.data.suspendedTrainers.length > 0 && (
        <div className="flex gap-3 rounded-2xl border border-warning/30 bg-warning-muted p-4 text-sm">
          <PauseCircle className="mt-0.5 size-5 shrink-0 text-warning" />
          <p className="text-muted-foreground">
            همکاری شما با {dashboard.data.suspendedTrainers.join("، ")} به‌خاطر پایان اشتراک مربی موقتاً متوقف
            است. برنامه‌های قبلی را می‌بینید، ولی برنامه و پیام تازه تا تمدید اشتراک مربی ارسال نمی‌شود.
          </p>
        </div>
      )}

      <StreakCard
        athleteId={athleteId}
        todaysWorkout={dashboard.data.todaysWorkout}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PlanSummaryCard
          title="برنامه تمرینی امروز"
          icon={Dumbbell}
          plan={dashboard.data.todaysWorkout}
          emptyTitle="برنامه تمرینی فعالی ندارید."
          emptyDescription="مربی شما به‌زودی یک برنامه تمرینی برایتان تنظیم می‌کند."
          planKind="workout"
        />
        {isEnabled("nutrition") && (
          <PlanSummaryCard
            title="برنامه غذایی"
            icon={Apple}
            plan={dashboard.data.nutritionPlan}
            emptyTitle="برنامه غذایی فعالی ندارید."
            emptyDescription="مربی شما به‌زودی یک برنامه غذایی برایتان تنظیم می‌کند."
            planKind="nutrition"
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {isEnabled("progress") && <ProgressDashboardWidget athleteId={athleteId} />}
        {isEnabled("messages") && <CoachMessageCard currentUserId={athleteId} />}
      </div>
    </div>
  );
}
