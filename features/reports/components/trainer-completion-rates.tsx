"use client";

import { Apple, Dumbbell } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { toPersianDigits } from "@/lib/persian";
import { StatisticsGrid } from "@/features/dashboard/components/shared/statistics-grid";
import { StatisticCard } from "@/features/dashboard/components/shared/statistic-card";
import { StatisticCardSkeleton } from "@/features/dashboard/components/shared/dashboard-skeleton";
import { useTrainerCompletionRates } from "../hooks/use-trainer-completion-rates";

export function TrainerCompletionRates() {
  const rates = useTrainerCompletionRates();

  if (rates.isLoading) {
    return (
      <StatisticsGrid>
        <StatisticCardSkeleton />
        <StatisticCardSkeleton />
      </StatisticsGrid>
    );
  }

  if (rates.isError || !rates.data) {
    return (
      <StatisticsGrid>
        <StatisticCard icon={Dumbbell} title="نرخ تکمیل برنامه تمرینی" value="—" />
        <StatisticCard icon={Apple} title="نرخ تکمیل برنامه غذایی" value="—" />
      </StatisticsGrid>
    );
  }

  return (
    <StatisticsGrid>
      <StatisticCard
        icon={Dumbbell}
        iconClassName="bg-warning-muted text-warning"
        title="نرخ تکمیل برنامه تمرینی"
        value={`${toPersianDigits(rates.data.workoutCompletionRate)}٪`}
        footer={<Progress value={rates.data.workoutCompletionRate} />}
      />
      <StatisticCard
        icon={Apple}
        iconClassName="bg-success-muted text-success"
        title="نرخ تکمیل برنامه غذایی"
        value={`${toPersianDigits(rates.data.nutritionCompletionRate)}٪`}
        footer={<Progress value={rates.data.nutritionCompletionRate} />}
      />
    </StatisticsGrid>
  );
}
