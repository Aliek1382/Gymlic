"use client";

import { Apple, Dumbbell, Users } from "lucide-react";

import { toPersianDigits } from "@/lib/persian";
import { StatisticsGrid } from "@/features/dashboard/components/shared/statistics-grid";
import { StatisticCard } from "@/features/dashboard/components/shared/statistic-card";
import { StatisticCardSkeleton } from "@/features/dashboard/components/shared/dashboard-skeleton";
import { useTrainerMonthlyStats } from "../hooks/use-trainer-monthly-stats";

export function TrainerMonthlyStats() {
  const stats = useTrainerMonthlyStats();

  if (stats.isLoading) {
    return (
      <StatisticsGrid>
        <StatisticCardSkeleton />
        <StatisticCardSkeleton />
        <StatisticCardSkeleton />
      </StatisticsGrid>
    );
  }

  if (stats.isError || !stats.data) {
    return (
      <StatisticsGrid>
        <StatisticCard icon={Users} title="ورزشکاران" value="—" />
        <StatisticCard
          icon={Dumbbell}
          title="برنامه‌های تمرینی این ماه"
          value="—"
        />
        <StatisticCard
          icon={Apple}
          title="برنامه‌های غذایی این ماه"
          value="—"
        />
      </StatisticsGrid>
    );
  }

  return (
    <StatisticsGrid>
      <StatisticCard
        icon={Users}
        iconClassName="bg-info-muted text-info"
        title="ورزشکاران"
        value={toPersianDigits(stats.data.athletesCount)}
      />
      <StatisticCard
        icon={Dumbbell}
        iconClassName="bg-warning-muted text-warning"
        title="برنامه‌های تمرینی این ماه"
        value={toPersianDigits(stats.data.workoutPlansThisMonth)}
      />
      <StatisticCard
        icon={Apple}
        iconClassName="bg-success-muted text-success"
        title="برنامه‌های غذایی این ماه"
        value={toPersianDigits(stats.data.nutritionPlansThisMonth)}
      />
    </StatisticsGrid>
  );
}
