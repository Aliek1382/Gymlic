"use client";

import { Banknote, Receipt, TicketPercent, TrendingUp } from "lucide-react";

import { Card, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PERSIAN_MONTH_NAMES, formatNumber, formatToman, toPersianDigits } from "@/lib/persian";
import { useQuery } from "@tanstack/react-query";

import { getRevenueReport } from "../services/admin-billing-service";
import { ExportButton } from "./export-button";
import { StatisticCard } from "@/features/dashboard/components/shared/statistic-card";
import { StatisticsGrid } from "@/features/dashboard/components/shared/statistics-grid";

/** "1405/07" -> "مهر ۱۴۰۵". */
function monthLabel(month: string): string {
  const [year, number] = month.split("/").map(Number);
  return `${PERSIAN_MONTH_NAMES[number - 1] ?? ""} ${toPersianDigits(year)}`;
}

export function AdminReportsPage() {
  // Grouped by the Jalali month each payment was approved in, on the server,
  // so this page and its CSV export always show the same figures.
  const { data } = useQuery({ queryKey: ["admin", "reports"], queryFn: getRevenueReport });

  const totalRevenue = data?.total ?? 0;
  const count = data?.count ?? 0;
  const avgAmount = count > 0 ? Math.round(totalRevenue / count) : 0;
  const monthRows = (data?.months ?? []).slice(0, 12);
  const planRows = data?.plans ?? [];
  const discountTotal = data?.discount_total ?? 0;

  return (

    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">گزارش مالی پلتفرم</h1>
          <p className="text-sm text-muted-foreground">
            درآمد حاصل از پرداخت‌های تأییدشدهٔ باشگاه‌ها (و مبالغی که هنگام تمدید دستی ثبت شده)، به
            تفکیک ماهِ تأیید.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButton kind="revenue" label="خروجی ماهانه" />
          <ExportButton kind="payments" label="خروجی همهٔ پرداخت‌ها" />
        </div>
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
          value={formatNumber(count)}
        />
        <StatisticCard
          icon={TrendingUp}
          title="میانگین هر پرداخت"
          value={`${formatToman(avgAmount)} تومان`}
        />
        {discountTotal > 0 && (
          <StatisticCard
            icon={TicketPercent}
            title="جمع تخفیف‌های داده‌شده"
            value={`${formatToman(discountTotal)} تومان`}
          />
        )}
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
                {monthRows.map((m) => (
                  <TableRow key={m.month}>
                    <TableCell className="text-foreground">{monthLabel(m.month)}</TableCell>
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
                {planRows.map((plan) => (
                  <TableRow key={plan.plan_name}>
                    <TableCell className="text-foreground">{plan.plan_name}</TableCell>
                    <TableCell className="text-muted-foreground">{formatNumber(plan.count)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatToman(plan.total)} تومان
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
