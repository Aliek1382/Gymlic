"use client";

import { Apple, Dumbbell } from "lucide-react";

import { useAthleteDashboard } from "../../hooks/use-athlete-dashboard";
import { WelcomeSection } from "../shared/welcome-section";
import { DashboardSkeleton } from "../shared/dashboard-skeleton";
import { ErrorState } from "../shared/error-state";
import { PlanSummaryCard } from "./plan-summary-card";
import { MeasurementsCard } from "./measurements-card";
import { CoachMessageCard } from "./coach-message-card";

export function AthleteDashboard({
  athleteName,
  trainerName,
}: {
  athleteName: string;
  trainerName: string | null;
}) {
  const dashboard = useAthleteDashboard();

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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PlanSummaryCard
          title="برنامه تمرینی امروز"
          icon={Dumbbell}
          plan={dashboard.data.todaysWorkout}
          emptyTitle="برنامه تمرینی فعالی ندارید."
          emptyDescription="مربی شما به‌زودی یک برنامه تمرینی برایتان تنظیم می‌کند."
        />
        <PlanSummaryCard
          title="برنامه غذایی"
          icon={Apple}
          plan={dashboard.data.nutritionPlan}
          emptyTitle="برنامه غذایی فعالی ندارید."
          emptyDescription="مربی شما به‌زودی یک برنامه غذایی برایتان تنظیم می‌کند."
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MeasurementsCard
          latest={dashboard.data.latestMeasurement}
          history={dashboard.data.measurementHistory}
        />
        <CoachMessageCard />
      </div>
    </div>
  );
}
