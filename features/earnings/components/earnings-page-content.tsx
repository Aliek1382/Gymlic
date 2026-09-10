"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

import { ChartCardSkeleton, TableCardSkeleton } from "@/features/dashboard/components/shared/dashboard-skeleton";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import { useTrainerEarningsSeries } from "../hooks/use-trainer-earnings-series";
import { useTrainerPayments } from "../hooks/use-trainer-payments";
import { EarningsSummaryCards } from "./earnings-summary-cards";
import { PaymentFormDialog } from "./payment-form-dialog";
import { PaymentLog } from "./payment-log";

// Code-split out of the page bundle: recharts is heavy and can't measure
// itself during server rendering anyway.
const TrainerEarningsChart = dynamic(
  () => import("./trainer-earnings-chart").then((m) => m.TrainerEarningsChart),
  { ssr: false, loading: () => <ChartCardSkeleton /> }
);

export function EarningsPageContent() {
  const [range, setRange] = useState("6");
  const series = useTrainerEarningsSeries(Number(range));
  const payments = useTrainerPayments();

  return (
    <div className="space-y-6">
      <EarningsSummaryCards />

      {series.isLoading ? (
        <ChartCardSkeleton />
      ) : series.isError ? (
        <ErrorState message="خطا در دریافت نمودار درآمد" />
      ) : (
        <TrainerEarningsChart
          data={series.data ?? []}
          range={range}
          onRangeChange={setRange}
        />
      )}

      <div className="flex justify-end">
        <PaymentFormDialog />
      </div>

      {payments.isLoading ? (
        <TableCardSkeleton />
      ) : payments.isError ? (
        <ErrorState message="خطا در دریافت تاریخچه‌ی پرداخت‌ها" />
      ) : (
        <PaymentLog payments={payments.data ?? []} />
      )}
    </div>
  );
}
