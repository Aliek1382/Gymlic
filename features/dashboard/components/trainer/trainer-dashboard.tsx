"use client";

import { Apple, CalendarCheck2, Dumbbell, LineChart, UserPlus, Users } from "lucide-react";

import { toPersianDigits } from "@/lib/persian";
import { useTrainerStatistics } from "../../hooks/use-trainer-statistics";
import { useTrainerRecentActivities } from "../../hooks/use-trainer-recent-activities";
import { useTrainerDraftPlans } from "../../hooks/use-trainer-draft-plans";
import { WelcomeSection } from "../shared/welcome-section";
import { StatisticsGrid } from "../shared/statistics-grid";
import { StatisticCard } from "../shared/statistic-card";
import {
  StatisticCardSkeleton,
  TableCardSkeleton,
} from "../shared/dashboard-skeleton";
import { ErrorState } from "../shared/error-state";
import { QuickActions } from "../shared/quick-actions";
import { TrainerRecentActivities } from "./trainer-recent-activities";
import { TrainerDraftPlans } from "./trainer-draft-plans";
import type { QuickAction } from "../../types/dashboard-types";

const QUICK_ACTIONS: QuickAction[] = [
  { label: "افزودن ورزشکار جدید", href: "/athletes?new=1", icon: UserPlus },
  { label: "ساخت برنامه تمرینی", href: "/workout-programs?new=1", icon: Dumbbell },
  { label: "ساخت برنامه غذایی", href: "/nutrition-programs?new=1", icon: Apple },
  { label: "کتابخانه حرکات", href: "/exercises", icon: LineChart },
];

export function TrainerDashboard({ trainerName }: { trainerName: string }) {
  const statistics = useTrainerStatistics();
  const activities = useTrainerRecentActivities();
  const draftPlans = useTrainerDraftPlans();

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
          <StatisticCard icon={CalendarCheck2} title="تمرین‌های امروز" value="—" />
        ) : (
          <StatisticCard
            icon={CalendarCheck2}
            iconClassName="bg-info-muted text-info"
            title="تمرین‌های امروز"
            value={toPersianDigits(statistics.data.todaysWorkoutsCount)}
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
