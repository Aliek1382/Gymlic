"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { ChevronLeft, Ruler } from "lucide-react";

import { Card, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toPersianDigits } from "@/lib/persian";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { useMeasurements } from "../hooks/use-measurements";
import { calculateBmi, getLatestKnownHeight } from "../utils/bmi";
import { buildPoints, seriesFor } from "../utils/build-points";
import { deltaFor } from "../utils/deltas";
import { MeasurementFormDialog } from "./measurement-form-dialog";

// Code-split out of the main bundle: recharts is heavy and this widget
// isn't needed until measurements have already loaded.
const MetricChart = dynamic(
  () => import("./metric-chart").then((m) => m.MetricChart),
  { ssr: false, loading: () => <Skeleton className="h-40 w-full rounded-xl" /> }
);

export function ProgressDashboardWidget({ athleteId }: { athleteId: string }) {
  const measurements = useMeasurements(athleteId);

  if (measurements.isLoading) {
    return <Skeleton className="h-80 w-full rounded-2xl" />;
  }

  const entries = measurements.data ?? [];
  const latest = entries[entries.length - 1] ?? null;
  const latestKnownHeight = getLatestKnownHeight(entries);
  const bmi = latest ? calculateBmi(latest.weightKg, latest.heightCm ?? latestKnownHeight) : null;
  const points = buildPoints(entries);

  const previousWeight =
    entries
      .slice(0, -1)
      .reverse()
      .find((entry) => entry.weightKg !== null)?.weightKg ?? null;
  const weightDelta =
    latest?.weightKg !== null && latest?.weightKg !== undefined && previousWeight !== null
      ? deltaFor(latest.weightKg, previousWeight)
      : null;

  return (
    <Card className="gap-4 py-5">
      <div className="flex items-center justify-between px-6">
        <CardTitle className="text-base">روند پیشرفت</CardTitle>
        <Link
          href="/progress"
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          مشاهده کامل
          <ChevronLeft className="size-3.5" />
        </Link>
      </div>

      <div className="space-y-4 px-6">
        {!latest ? (
          <EmptyState
            icon={Ruler}
            title="هنوز اندازه‌گیری‌ای ثبت نشده است."
            description="با دکمه پایین اولین اندازه‌گیری خود را ثبت کنید."
          />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              <div className="rounded-xl bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">وزن</p>
                <p className="text-sm font-bold text-foreground">
                  {latest.weightKg ? toPersianDigits(latest.weightKg) : "—"}
                </p>
                {weightDelta && (
                  <p className="text-xs text-muted-foreground">
                    {weightDelta.label} نسبت به قبل
                  </p>
                )}
              </div>
              <div className="rounded-xl bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">BMI</p>
                <p className="text-sm font-bold text-foreground">
                  {bmi ? toPersianDigits(bmi) : "—"}
                </p>
              </div>
              <div className="rounded-xl bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">چربی</p>
                <p className="text-sm font-bold text-foreground">
                  {latest.bodyFatPercent ? `${toPersianDigits(latest.bodyFatPercent)}٪` : "—"}
                </p>
              </div>
              <div className="rounded-xl bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">دور کمر</p>
                <p className="text-sm font-bold text-foreground">
                  {latest.waistCm ? toPersianDigits(latest.waistCm) : "—"}
                </p>
              </div>
              <div className="rounded-xl bg-muted p-3 text-center">
                <p className="text-xs text-muted-foreground">دور سینه</p>
                <p className="text-sm font-bold text-foreground">
                  {latest.chestCm ? toPersianDigits(latest.chestCm) : "—"}
                </p>
              </div>
            </div>

            <MetricChart
              series={seriesFor(points, "weight")}
              color="var(--chart-1)"
              unit="کیلوگرم"
              height={160}
            />
          </>
        )}

        <MeasurementFormDialog
          athleteId={athleteId}
          latestKnownHeight={latestKnownHeight}
        />
      </div>
    </Card>
  );
}
