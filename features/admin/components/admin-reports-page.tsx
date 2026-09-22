"use client";

import { Banknote, Receipt, TrendingUp } from "lucide-react";

import { Card, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber, formatToman, getPersianMonthLabel } from "@/lib/persian";
import { useQuery } from "@tanstack/react-query";

import { listPaymentRequests } from "../services/admin-service";
import { StatisticCard } from "@/features/dashboard/components/shared/statistic-card";
import { StatisticsGrid } from "@/features/dashboard/components/shared/statistics-grid";

export function AdminReportsPage() {
  const { data } = useQuery({
    queryKey: ["admin", "reports"],
    queryFn: async () => {
      const rows = (await listPaymentRequests()).filter(
        (request) => request.status === "approved"
      );

      const totalRevenue = rows.reduce((sum, r) => sum + r.amount_toman, 0);
      const avgAmount = rows.length > 0 ? Math.round(totalRevenue / rows.length) : 0;

      const byMonth = new Map<string, { label: string; total: number; count: number }>();
      for (const r of rows) {
        const date = new Date(r.created_at);
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        const label = getPersianMonthLabel(date);
        const entry = byMonth.get(key) ?? { label, total: 0, count: 0 };
        entry.total += r.amount_toman;
        entry.count += 1;
        byMonth.set(key, entry);
      }
      const monthRows = Array.from(byMonth.entries())
        .sort(([a], [b]) => (a < b ? 1 : -1))
        .slice(0, 12)
        .map(([, value]) => value);

      const byPlan = new Map<string, { total: number; count: number }>();
      for (const r of rows) {
        const name = r.plan_name ?? "بدون پلن";
        const entry = byPlan.get(name) ?? { total: 0, count: 0 };
        entry.total += r.amount_toman;
        entry.count += 1;
        byPlan.set(name, entry);
      }
      const planRows = Array.from(byPlan.entries()).sort(([, a], [, b]) => b.total - a.total);

      return { rows, totalRevenue, avgAmount, monthRows, planRows };
    },
  });

  const rows = data?.rows ?? [];
  const totalRevenue = data?.totalRevenue ?? 0;
  const avgAmount = data?.avgAmount ?? 0;
  const monthRows = data?.monthRows ?? [];
  const planRows = data?.planRows ?? [];

  return (

    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">گزارش مالی پلتفرم</h1>
        <p className="text-sm text-muted-foreground">
          درآمد حاصل از تایید درخواست‌های پرداخت باشگاه‌ها.
        </p>
      </div>

      <StatisticsGrid>
        <StatisticCard
          icon={Banknote}
          title="درآمد کل"
          value={`${formatToman(totalRevenue)} تومان`}
        />
        <StatisticCard
          icon={Receipt}
          title="تعداد پرداخت‌های تاییدشده"
          value={formatNumber(rows.length)}
        />
        <StatisticCard
          icon={TrendingUp}
          title="میانگین هر پرداخت"
          value={`${formatToman(avgAmount)} تومان`}
        />
      </StatisticsGrid>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="gap-4 py-5">
          <div className="px-6">
            <CardTitle className="text-base">درآمد به تفکیک ماه</CardTitle>
          </div>
          {monthRows.length === 0 ? (
            <p className="px-6 text-sm text-muted-foreground">هنوز پرداخت تاییدشده‌ای ثبت نشده است.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ماه</TableHead>
                  <TableHead>تعداد</TableHead>
                  <TableHead>مبلغ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthRows.map((m, index) => (
                  <TableRow key={index}>
                    <TableCell className="text-foreground">{m.label}</TableCell>
                    <TableCell className="text-muted-foreground">{formatNumber(m.count)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatToman(m.total)} تومان
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className="gap-4 py-5">
          <div className="px-6">
            <CardTitle className="text-base">درآمد به تفکیک پلن</CardTitle>
          </div>
          {planRows.length === 0 ? (
            <p className="px-6 text-sm text-muted-foreground">هنوز پرداخت تاییدشده‌ای ثبت نشده است.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>پلن</TableHead>
                  <TableHead>تعداد</TableHead>
                  <TableHead>مبلغ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {planRows.map(([name, value]) => (
                  <TableRow key={name}>
                    <TableCell className="text-foreground">{name}</TableCell>
                    <TableCell className="text-muted-foreground">{formatNumber(value.count)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatToman(value.total)} تومان
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
