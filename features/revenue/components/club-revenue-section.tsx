"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

import {
  ChartCardSkeleton,
  TableCardSkeleton,
} from "@/features/dashboard/components/shared/dashboard-skeleton";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import { useRevenueSeries } from "@/features/dashboard/hooks/use-revenue-series";
import { useRevenueEntries } from "../hooks/use-revenue-entries";
import { RevenueFormDialog } from "./revenue-form-dialog";
import { RevenueLog } from "./revenue-log";
import { RevenueSummaryCards } from "./revenue-summary-cards";

// Code-split out of the page bundle: recharts is heavy and can't measure
// itself during server rendering anyway.
const RevenueChart = dynamic(
  () =>
    import("@/features/dashboard/components/club/revenue-chart").then(
      (m) => m.RevenueChart
    ),
  { ssr: false, loading: () => <ChartCardSkeleton /> }
);

/** The club's own income: what came in, from whom, and the monthly trend. */
export function ClubRevenueSection({ clubId }: { clubId: string }) {
  const [range, setRange] = useState("6");
  const series = useRevenueSeries(clubId, Number(range));
  const entries = useRevenueEntries(clubId);

  return (
    <div className="space-y-6">
      <RevenueSummaryCards clubId={clubId} />

      {series.isLoading ? (
        <ChartCardSkeleton />
      ) : series.isError ? (
        <ErrorState message="خطا در دریافت نمودار درآمد" />
      ) : (
        <RevenueChart
          data={series.data ?? []}
          range={range}
          onRangeChange={setRange}
        />
      )}

      <div className="flex justify-end">
        <RevenueFormDialog clubId={clubId} />
      </div>

      {entries.isLoading ? (
        <TableCardSkeleton />
      ) : entries.isError ? (
        <ErrorState message="خطا در دریافت تاریخچه‌ی دریافتی‌ها" />
      ) : (
        <RevenueLog clubId={clubId} entries={entries.data ?? []} />
      )}
    </div>
  );
}
