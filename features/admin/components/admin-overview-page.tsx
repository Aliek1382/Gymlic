"use client";

import {
  Banknote,
  Clock,
  Dumbbell,
  ReceiptText,
  Users,
  UsersRound,
} from "lucide-react";

import { useQuery } from "@tanstack/react-query";

import { getAdminOverview } from "../services/admin-service";
import { formatNumber, formatToman } from "@/lib/persian";
import { StatisticCard } from "@/features/dashboard/components/shared/statistic-card";
import { StatisticsGrid } from "@/features/dashboard/components/shared/statistics-grid";

export function AdminOverviewPage() {
  const { data } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: getAdminOverview,
  });

  const clubsCount = data?.clubs_count ?? 0;
  const pendingClubsCount = data?.pending_clubs_count ?? 0;
  const trainersCount = data?.trainers_count ?? 0;
  const athletesCount = data?.athletes_count ?? 0;
  const pendingRequestsCount = data?.pending_requests_count ?? 0;
  const activeSubs = data?.active_subs ?? 0;
  const expiringSubs = data?.expiring_subs ?? 0;
  const expiredSubs = data?.expired_subs ?? 0;
  const totalRevenue = data?.total_revenue ?? 0;

  return (

    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">نمای کلی پلتفرم</h1>
        <p className="text-sm text-muted-foreground">
          خلاصه‌ی وضعیت باشگاه‌ها، اشتراک‌ها و درآمد جیم‌لیک.
        </p>
      </div>

      <StatisticsGrid>
        <StatisticCard
          icon={Users}
          title="تعداد باشگاه‌ها"
          value={formatNumber(clubsCount ?? 0)}
        />
        <StatisticCard
          icon={Dumbbell}
          title="تعداد مربی‌ها"
          value={formatNumber(trainersCount ?? 0)}
        />
        <StatisticCard
          icon={UsersRound}
          title="تعداد ورزشکاران"
          value={formatNumber(athletesCount ?? 0)}
        />
        <StatisticCard
          icon={Clock}
          title="باشگاه‌های در انتظار تایید"
          value={formatNumber(pendingClubsCount ?? 0)}
          iconClassName={
            (pendingClubsCount ?? 0) > 0 ? "bg-warning-muted text-warning" : undefined
          }
        />
        <StatisticCard
          icon={ReceiptText}
          title="درخواست پرداخت در انتظار"
          value={formatNumber(pendingRequestsCount ?? 0)}
          iconClassName={
            (pendingRequestsCount ?? 0) > 0
              ? "bg-warning-muted text-warning"
              : undefined
          }
        />
        <StatisticCard
          icon={Banknote}
          title="درآمد کل تاییدشده"
          value={`${formatToman(totalRevenue)} تومان`}
        />
        <StatisticCard
          icon={Users}
          title="اشتراک‌های فعال"
          value={formatNumber(activeSubs)}
          iconClassName="bg-success-muted text-success"
        />
        <StatisticCard
          icon={Users}
          title="در حال انقضا"
          value={formatNumber(expiringSubs)}
          iconClassName="bg-warning-muted text-warning"
        />
        <StatisticCard
          icon={Users}
          title="منقضی‌شده"
          value={formatNumber(expiredSubs)}
          iconClassName="bg-destructive/10 text-destructive"
        />
      </StatisticsGrid>
    </div>
  );
}
