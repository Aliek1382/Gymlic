"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";

import { Card, CardTitle } from "@/components/ui/card";
import { JalaliDateField } from "@/components/ui/jalali-date-field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import { TableCardSkeleton } from "@/features/dashboard/components/shared/dashboard-skeleton";
import { toIsoDate, todayIso } from "@/lib/iso-date";
import {
  formatNumber,
  formatToman,
  getPersianMonthLabel,
  toPersianDigits,
} from "@/lib/persian";
import { useFinancialSummary } from "../hooks/use-financial-summary";
import { PAYMENT_METHOD_LABELS } from "../types/earnings-types";

function defaultFrom(): string {
  const now = new Date();
  return toIsoDate(new Date(now.getFullYear(), now.getMonth() - 5, 1));
}

function monthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return `${getPersianMonthLabel(new Date(year, m - 1, 1))} ${toPersianDigits(year)}`;
}

/** Month × payment method totals for a date range, summed by the server. */
export function FinancialSummaryCard() {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(todayIso);
  const summary = useFinancialSummary(from, to);
  const invalidRange = from > to;
  const rows = summary.data ?? [];

  return (
    <Card className="gap-4 py-5">
      <div className="px-6">
        <CardTitle className="text-base">گزارش مالی به تفکیک روش پرداخت</CardTitle>
      </div>

      <div className="grid gap-4 px-6 sm:grid-cols-2">
        <JalaliDateField
          id="financial-from"
          label="از تاریخ"
          value={from}
          onChange={setFrom}
          pastYears={5}
        />
        <JalaliDateField
          id="financial-to"
          label="تا تاریخ"
          value={to}
          onChange={setTo}
          pastYears={5}
        />
      </div>

      <div className="px-6">
        {invalidRange ? (
          <p className="text-sm text-destructive">
            تاریخ شروع باید قبل از تاریخ پایان باشد.
          </p>
        ) : summary.isLoading ? (
          <TableCardSkeleton />
        ) : summary.isError ? (
          <ErrorState message="خطا در دریافت گزارش مالی" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="در این بازه پرداختی ثبت نشده است."
            description="بازه‌ی دیگری را انتخاب کنید یا پرداخت جدیدی ثبت کنید."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ماه</TableHead>
                <TableHead>روش پرداخت</TableHead>
                <TableHead>جمع مبلغ (تومان)</TableHead>
                <TableHead>تعداد تراکنش</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.month}-${row.paymentMethod}`}>
                  <TableCell>{monthLabel(row.month)}</TableCell>
                  <TableCell>{PAYMENT_METHOD_LABELS[row.paymentMethod]}</TableCell>
                  <TableCell title={`${formatNumber(row.totalToman)} تومان`}>
                    {formatToman(row.totalToman)}
                  </TableCell>
                  <TableCell>{formatNumber(row.count)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </Card>
  );
}
