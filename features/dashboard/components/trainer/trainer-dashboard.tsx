"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Apple, CheckCircle2, Dumbbell, LineChart, UserPlus, Users, Wallet } from "lucide-react";

import { toPersianDigits } from "@/lib/persian";
import { MonthlyEarningsCard } from "@/features/earnings/components/monthly-earnings-card";
import { useTrainerEarningsSeries } from "@/features/earnings/hooks/use-trainer-earnings-series";
import { useTrainerStatistics } from "../../hooks/use-trainer-statistics";
import { useTrainerRecentActivities } from "../../hooks/use-trainer-recent-activities";
import { useTrainerDraftPlans } from "../../hooks/use-trainer-draft-plans";
import { WelcomeSection } from "../shared/welcome-section";
import { StatisticsGrid } from "../shared/statistics-grid";
import { StatisticCard } from "../shared/statistic-card";
import {
  ChartCardSkeleton,
  StatisticCardSkeleton,
  TableCardSkeleton,
} from "../shared/dashboard-skeleton";
import { ErrorState } from "../shared/error-state";
import { QuickActions } from "../shared/quick-actions";
import { TrainerRecentActivities } from "./trainer-recent-activities";
import { TrainerDraftPlans } from "./trainer-draft-plans";
import type { QuickAction } from "../../types/dashboard-types";

// Code-split out of the dashboard bundle for the same reason the club
// dashboard splits its charts: recharts is heavy, and ResponsiveContainer
// can't measure correctly during server rendering.
const TrainerEarningsChart = dynamic(
  () =>
    import("@/features/earnings/components/trainer-earnings-chart").then(
      (m) => m.TrainerEarningsChart
    ),
  { ssr: false, loading: () => <ChartCardSkeleton className="lg:col-span-2" /> }
);

const QUICK_ACTIONS: QuickAction[] = [
  { label: "افزودن ورزشکار جدید", href: "/athletes?new=1", icon: UserPlus },
  { label: "ساخت برنامه تمرینی", href: "/workout-programs?new=1", icon: Dumbbell },
  { label: "ساخت برنامه غذایی", href: "/nutrition-programs?new=1", icon: Apple },
  { label: "کتابخانه حرکات", href: "/exercises", icon: LineChart },
  { label: "ثبت درآمد", href: "/earnings", icon: Wallet },
];

export function TrainerDashboard({ trainerName }: { trainerName: string }) {
  const [earningsRange, setEarningsRange] = useState("6");
  const statistics = useTrainerStatistics();
  const activities = useTrainerRecentActivities();
  const draftPlans = useTrainerDraftPlans();
  const earningsSeries = useTrainerEarningsSeries(Number(earningsRange));

  return (
    <div className="space-y-6">
      <WelcomeSection
        name={trainerName}
        subtitle="امروز چه شاگردهایی و چه برنامه‌هایی در انتظار شما هستند را ببینید."
      />

      <StatisticsGrid>
        {statistics.isLoading ? (
          <StatisticCardSkeleton />
        ) : statistics.isError || !statistics.data ? (
          <StatisticCard icon={Users} title="ورزشکاران" value="—" />
        ) : (
          <StatisticCard
            icon={Users}
            iconClassName="bg-info-muted text-info"
            title="ورزشکاران"
            value={toPersianDigits(statistics.data.athletesCount)}
          />
        )}

        {statistics.isLoading ? (
          <StatisticCardSkeleton />
        ) : statistics.isError || !statistics.data ? (
          <StatisticCard icon={Dumbbell} title="برنامه‌های فعال" value="—" />
        ) : (
          <StatisticCard
            icon={Dumbbell}
            iconClassName="bg-warning-muted text-warning"
            title="برنامه‌های فعال"
            value={toPersianDigits(statistics.data.activeWorkoutProgramsCount)}
          />
        )}

        {statistics.isLoading ? (
          <StatisticCardSkeleton />
        ) : statistics.isError || !statistics.data ? (
          <StatisticCard icon={CheckCircle2} title="برنامه‌های تکمیل‌شده" value="—" />
        ) : (
          <StatisticCard
            icon={CheckCircle2}
            iconClassName="bg-info-muted text-info"
            title="برنامه‌های تکمیل‌شده"
            value={toPersianDigits(statistics.data.completedProgramsCount)}
          />
        )}

        {statistics.isLoading ? (
          <StatisticCardSkeleton />
        ) : statistics.isError || !statistics.data ? (
          <StatisticCard icon={Apple} title="رژیم‌های فعال" value="—" />
        ) : (
          <StatisticCard
            icon={Apple}
            iconClassName="bg-success-muted text-success"
            title="رژیم‌های فعال"
            value={toPersianDigits(statistics.data.activeNutritionPlansCount)}
          />
        )}
      </StatisticsGrid>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {earningsSeries.isLoading ? (
          <ChartCardSkeleton className="lg:col-span-2" />
        ) : earningsSeries.isError ? (
          <ErrorState message="خطا در دریافت نمودار درآمد" />
        ) : (
          <TrainerEarningsChart
            data={earningsSeries.data ?? []}
            range={earningsRange}
            onRangeChange={setEarningsRange}
          />
        )}

        <MonthlyEarningsCard />
      </div>

      {activities.isLoading ? (
        <TableCardSkeleton />
      ) : activities.isError ? (
        <ErrorState message="خطا در دریافت آخرین فعالیت‌ها" />
      ) : (
        <TrainerRecentActivities activities={activities.data ?? []} />
      )}

      {draftPlans.isLoading ? (
        <TableCardSkeleton />
      ) : draftPlans.isError ? (
        <ErrorState message="خطا در دریافت پیش‌نویس‌ها" />
      ) : (
        <TrainerDraftPlans drafts={draftPlans.data ?? []} />
      )}

      <QuickActions actions={QUICK_ACTIONS} />
    </div>
  );
}
