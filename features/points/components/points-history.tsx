"use client";

import { Trophy } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { formatPersianDate, toPersianDigits } from "@/lib/persian";
import { useMyPoints } from "../hooks/use-my-points";
import { PointsWidget } from "./points-widget";

/** «تاریخچهٔ امتیاز من»: the latest awards, so a coach can see why they got them. */
export function PointsHistory() {
  const points = useMyPoints();

  return (
    <div className="space-y-6">
      <PointsWidget />

      <Card className="gap-4 py-5">
        <h2 className="px-6 text-base font-bold text-foreground">آخرین امتیازها</h2>
        <div className="space-y-2 px-6">
          {points.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : points.isError ? (
            <p className="text-sm text-destructive">دریافت تاریخچه امتیاز با خطا مواجه شد.</p>
          ) : !points.data || points.data.recentLogs.length === 0 ? (
            <EmptyState icon={Trophy} title="هنوز امتیازی کسب نکرده‌اید." />
          ) : (
            points.data.recentLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
              >
                <div>
                  <p className="text-sm text-foreground">{log.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatPersianDate(new Date(log.createdAt.replace(" ", "T")))}
                  </p>
                </div>
                {/* Negative only when the admin took points away by hand. */}
                <span
                  className={cn(
                    "text-sm font-bold",
                    log.points < 0 ? "text-destructive" : "text-success"
                  )}
                  dir="ltr"
                >
                  {log.points < 0 ? "−" : "+"}
                  {toPersianDigits(Math.abs(log.points))}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
