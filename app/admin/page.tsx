import {
  Banknote,
  Clock,
  Dumbbell,
  ReceiptText,
  Users,
  UsersRound,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatNumber, formatToman } from "@/lib/persian";
import { StatisticCard } from "@/features/dashboard/components/shared/statistic-card";
import { StatisticsGrid } from "@/features/dashboard/components/shared/statistics-grid";

export const metadata = { title: "نمای کلی | پنل مدیریت جیم‌لیک" };

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const [
    { count: clubsCount },
    { count: pendingClubsCount },
    { count: trainersCount },
    { count: athletesCount },
    { count: pendingRequestsCount },
    { data: subscriptions },
    { data: approvedRequests },
  ] = await Promise.all([
    supabase.from("clubs").select("id", { count: "exact", head: true }),
    supabase
      .from("clubs")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("account_type", "trainer"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("account_type", "athlete"),
    supabase
      .from("payment_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase.from("subscriptions").select("status"),
    supabase.from("payment_requests").select("amount_toman").eq("status", "approved"),
  ]);

  const activeSubs = subscriptions?.filter((s) => s.status === "active").length ?? 0;
  const expiringSubs = subscriptions?.filter((s) => s.status === "expiring").length ?? 0;
  const expiredSubs = subscriptions?.filter((s) => s.status === "expired").length ?? 0;
  const totalRevenue = (approvedRequests ?? []).reduce(
    (sum, r) => sum + r.amount_toman,
    0
  );

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
