"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";

import { Card, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { buildPoints, METRICS, seriesFor } from "../utils/build-points";
import type { MeasurementEntry } from "../types/progress-types";

// Code-split out of the main bundle: recharts is heavy and this widget
// isn't needed until progress data has already loaded and rendered.
const MetricChart = dynamic(
  () => import("./metric-chart").then((m) => m.MetricChart),
  { ssr: false, loading: () => <Skeleton className="h-[208px] w-full rounded-xl" /> }
);

export function ProgressCharts({ entries }: { entries: MeasurementEntry[] }) {
  const points = useMemo(() => buildPoints(entries), [entries]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {METRICS.map((metric) => (
        <Card key={metric.key} className="gap-3 py-5">
          <div className="px-6">
            <CardTitle className="text-sm">{metric.title}</CardTitle>
          </div>
          <div className="px-4">
            <MetricChart
              series={seriesFor(points, metric.key)}
              color={metric.color}
              unit={metric.unit}
              height={208}
            />
          </div>
        </Card>
      ))}
    </div>
  );
}
