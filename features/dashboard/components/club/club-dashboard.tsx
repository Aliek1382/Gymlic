"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Banknote, CalendarCheck2, Dumbbell, Settings, UserPlus, Users } from "lucide-react";

import { formatToman, toPersianDigits } from "@/lib/persian";
import { useDashboardStatistics } from "../../hooks/use-dashboard-statistics";
import { useMemberDistribution } from "../../hooks/use-member-distribution";
import { useRevenueSeries } from "../../hooks/use-revenue-series";
import { useRecentActivities } from "../../hooks/use-recent-activities";
import { useSubscription } from "../../hooks/use-subscription";
import { WelcomeSection } from "../shared/welcome-section";
import { StatisticsGrid } from "../shared/statistics-grid";
import { StatisticCard } from "../shared/statistic-card";
import {
  ChartCardSkeleton,
  StatisticCardSkeleton,
  TableCardSkeleton,
} from "../shared/dashboard-skeleton";
import { ErrorState } from "../shared/error-state";
import { MiniBarSparkline } from "../shared/mini-bar-sparkline";
import { AvatarStack } from "../shared/avatar-stack";
import { Progress } from "@/components/ui/progress";
import { RecentActivitiesTable } from "./recent-activities-table";
import { SubscriptionCard } from "../shared/subscription-card";
import { QuickActions } from "../shared/quick-actions";
import { ExpiringMembershipsCard } from "@/features/members";
import type { QuickAction } from "../../types/dashboard-types";

// Code-split out of the main dashboard bundle: recharts is heavy, the data
// these need isn't ready until their own query resolves anyway, and
// ResponsiveContainer can't measure correctly during server rendering.
const MemberDistributionChart = dynamic(
  () => import("./member-distribution-chart").then((m) => m.MemberDistributionChart),
  { ssr: false, loading: () => <ChartCardSkeleton /> }
);
const RevenueChart = dynamic(
  () => import("./revenue-chart").then((m) => m.RevenueChart),
  { ssr: false, loading: () => <ChartCardSkeleton className="lg:col-span-2" /> }
);

const QUICK_ACTIONS: QuickAction[] = [
  { label: "افزودن عضو جدید", href: "/members?new=1", icon: UserPlus },
  { label: "افزودن مربی", href: "/trainers?new=1", icon: Dumbbell },
  { label: "ساخت کلاس جدید", href: "/classes?new=1", icon: CalendarCheck2 },
  { label: "تنظیمات باشگاه", href: "/settings", icon: Settings },
];

export function ClubDashboard({
  ownerName,
  clubId,
}: {
  ownerName: string;
  clubId: string;
}) {
  const [revenueRange, setRevenueRange] = useState("6");
  const statistics = useDashboardStatistics(clubId);
  const memberDistribution = useMemberDistribution(clubId);
  const revenueSeries = useRevenueSeries(clubId, Number(revenueRange));
  const recentActivities = useRecentActivities(clubId);
  const subscription = useSubscription(clubId);

  return (
    <div className="space-y-6">
      <WelcomeSection
        name={ownerName}
        subtitle="اتفاقات امروز جیم‌لیک را اینجا دنبال کنید."
      />

      <StatisticsGrid>
        {statistics.isLoading ? (
          <StatisticCardSkeleton />
        ) : statistics.isError || !statistics.data ? (
          <StatisticCard
            icon={Users}
            title="کل اعضا"
            value="—"
            footer={<ErrorState message="خطا در دریافت آمار اعضا" />}
          />
        ) : (
          <StatisticCard
            icon={Users}
            iconClassName="bg-info-muted text-info"
            title="کل اعضا"
            value={toPersianDigits(statistics.data.totalMembersCount)}
            trend={statistics.data.totalMembersTrend}
            footer={
              <Progress
                value={
                  statistics.data.totalMembersTarget > 0
                    ? Math.min(
                        100,
                        (statistics.data.totalMembersCount /
                          statistics.data.totalMembersTarget) *
                          100
                      )
                    : 0
                }
              />
            }
          />
        )}

        {statistics.isLoading ? (
          <StatisticCardSkeleton />
        ) : statistics.isError || !statistics.data ? (
          <StatisticCard icon={Dumbbell} title="مربیان فعال" value="—" />
        ) : (
          <StatisticCard
            icon={Dumbbell}
            iconClassName="bg-warning-muted text-warning"
            title="مربیان فعال"
            value={toPersianDigits(statistics.data.activeTrainersCount)}
            trend={statistics.data.activeTrainersTrend}
            footer={
              <AvatarStack
                items={statistics.data.trainerAvatars}
                overflowCount={Math.max(
                  0,
                  statistics.data.activeTrainersCount -
                    statistics.data.trainerAvatars.length
                )}
              />
            }
          />
        )}

        {statistics.isLoading ? (
          <StatisticCardSkeleton />
        ) : statistics.isError || !statistics.data ? (
          <StatisticCard icon={Banknote} title="درآمد ماهانه" value="—" />
        ) : (
          <StatisticCard
            icon={Banknote}
            iconClassName="bg-success-muted text-success"
            title="درآمد ماهانه"
            value={formatToman(statistics.data.monthlyRevenue)}
            trend={statistics.data.monthlyRevenueTrend}
            footer={
              <MiniBarSparkline values={statistics.data.monthlyRevenueSeries} />
            }
          />
        )}

        {statistics.isLoading ? (
          <StatisticCardSkeleton />
        ) : statistics.isError || !statistics.data ? (
          <StatisticCard icon={CalendarCheck2} title="حضور در کلاس" value="—" />
        ) : (
          <StatisticCard
            icon={CalendarCheck2}
            iconClassName="bg-info-muted text-info"
            title="حضور در کلاس"
            value={`${toPersianDigits(statistics.data.classAttendancePercent)}٪`}
            trend={statistics.data.classAttendanceTrend}
            footer={<Progress value={statistics.data.classAttendancePercent} />}
          />
        )}
      </StatisticsGrid>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {revenueSeries.isLoading ? (
          <ChartCardSkeleton className="lg:col-span-2" />
        ) : revenueSeries.isError ? (
          <ErrorState message="خطا در دریافت نمودار درآمد" />
        ) : (
          <RevenueChart
            data={revenueSeries.data ?? []}
            range={revenueRange}
            onRangeChange={setRevenueRange}
          />
        )}

        {memberDistribution.isLoading ? (
          <ChartCardSkeleton />
        ) : memberDistribution.isError || !memberDistribution.data ? (
          <ErrorState message="خطا در دریافت توزیع اعضا" />
        ) : (
          <MemberDistributionChart data={memberDistribution.data} />
        )}
      </div>

      {recentActivities.isLoading ? (
        <TableCardSkeleton />
      ) : recentActivities.isError ? (
        <ErrorState message="خطا در دریافت فعالیت‌های اخیر" />
      ) : (
        <RecentActivitiesTable activities={recentActivities.data ?? []} />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <QuickActions actions={QUICK_ACTIONS} />
          <ExpiringMembershipsCard clubId={clubId} />
        </div>
        {subscription.isLoading ? (
          <ChartCardSkeleton />
        ) : subscription.isError ? (
          <ErrorState message="خطا در دریافت وضعیت اشتراک" />
        ) : (
          <SubscriptionCard subscription={subscription.data ?? null} />
        )}
      </div>
    </div>
  );
}
