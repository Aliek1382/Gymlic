"use client";

import { Wallet } from "lucide-react";

import { formatToman } from "@/lib/persian";
import { StatisticCard } from "@/features/dashboard/components/shared/statistic-card";
import { StatisticCardSkeleton } from "@/features/dashboard/components/shared/dashboard-skeleton";
import { MiniBarSparkline } from "@/features/dashboard/components/shared/mini-bar-sparkline";
import { useTrainerEarningsSummary } from "../hooks/use-trainer-earnings-summary";

/**
 * The headline earnings card. Self-contained — it owns its own query and
 * loading/error states so the trainer dashboard can just drop it in.
 */
export function MonthlyEarningsCard() {
  const summary = useTrainerEarningsSummary();

  if (summary.isLoading) return <StatisticCardSkeleton />;

  if (summary.isError || !summary.data) {
    return <StatisticCard icon={Wallet} title="درآمد این ماه" value="—" />;
  }

  return (
    <StatisticCard
      icon={Wallet}
      iconClassName="bg-success-muted text-success"
      title="درآمد این ماه"
      value={formatToman(summary.data.currentMonth)}
      trend={summary.data.currentMonthTrend}
      footer={<MiniBarSparkline values={summary.data.weeklySeries} />}
    />
  );
}
