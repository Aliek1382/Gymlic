"use client";

import { CalendarRange, Receipt, Users, Wallet } from "lucide-react";

import { formatToman, toPersianDigits } from "@/lib/persian";
import { StatisticsGrid } from "@/features/dashboard/components/shared/statistics-grid";
import { StatisticCard } from "@/features/dashboard/components/shared/statistic-card";
import { StatisticCardSkeleton } from "@/features/dashboard/components/shared/dashboard-skeleton";
import { MiniBarSparkline } from "@/features/dashboard/components/shared/mini-bar-sparkline";
import { useClubRevenueSummary } from "../hooks/use-club-revenue-summary";

/** The four-card row at the top of the club revenue tab. */
export function RevenueSummaryCards({ clubId }: { clubId: string }) {
  const summary = useClubRevenueSummary(clubId);

  if (summary.isLoading) {
    return (
      <StatisticsGrid>
        {Array.from({ length: 4 }).map((_, index) => (
          <StatisticCardSkeleton key={index} />
        ))}
      </StatisticsGrid>
    );
  }

  if (summary.isError || !summary.data) {
    return (
      <StatisticsGrid>
        <StatisticCard icon={Wallet} title="درآمد این ماه" value="—" />
        <StatisticCard icon={Wallet} title="درآمد ماه گذشته" value="—" />
        <StatisticCard icon={CalendarRange} title="درآمد ۱۲ ماه گذشته" value="—" />
        <StatisticCard icon={Users} title="اعضای پرداخت‌کرده" value="—" />
      </StatisticsGrid>
    );
  }

  const data = summary.data;

  return (
    <StatisticsGrid>
      <StatisticCard
        icon={Wallet}
        iconClassName="bg-success-muted text-success"
        title="درآمد این ماه"
        value={formatToman(data.currentMonth)}
        trend={data.currentMonthTrend}
        footer={<MiniBarSparkline values={data.weeklySeries} />}
      />
      <StatisticCard
        icon={Wallet}
        iconClassName="bg-info-muted text-info"
        title="درآمد ماه گذشته"
        value={formatToman(data.previousMonth)}
      />
      <StatisticCard
        icon={CalendarRange}
        iconClassName="bg-warning-muted text-warning"
        title="درآمد ۱۲ ماه گذشته"
        value={formatToman(data.lastTwelveMonths)}
      />
      <StatisticCard
        icon={Receipt}
        iconClassName="bg-info-muted text-info"
        title="دریافتی‌های این ماه"
        value={`${toPersianDigits(data.entriesThisMonth)} فقره`}
        footer={
          <p className="text-xs text-muted-foreground">
            از {toPersianDigits(data.payingMembersThisMonth)} عضو
          </p>
        }
      />
    </StatisticsGrid>
  );
}
