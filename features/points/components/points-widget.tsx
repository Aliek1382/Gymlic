"use client";

import Link from "next/link";
import { ChevronLeft, Trophy } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toPersianDigits } from "@/lib/persian";
import { useMyPoints } from "../hooks/use-my-points";

/** Dashboard card: total points, level name and progress toward the next level. */
export function PointsWidget() {
  const points = useMyPoints();

  if (points.isLoading) {
    return <Skeleton className="h-32 w-full rounded-2xl" />;
  }
  // Decorative, so a failure (or the tables not existing yet) just hides it.
  if (points.isError || !points.data) {
    return null;
  }

  const { totalPoints, level, pointsToNextLevel } = points.data;
  const span = level.nextMinPoints !== null ? level.nextMinPoints - level.minPoints : 0;
  const percent =
    span > 0 ? Math.max(0, Math.min(100, ((totalPoints - level.minPoints) / span) * 100)) : 100;

  return (
    <Card className="gap-4 py-5">
      <div className="flex items-center justify-between gap-3 px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-warning-muted text-warning">
            <Trophy className="size-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">امتیاز من</p>
            <p className="text-2xl font-bold text-foreground">
              {toPersianDigits(totalPoints)}{" "}
              <span className="text-sm font-medium text-muted-foreground">· {level.name}</span>
            </p>
          </div>
        </div>
        <Link
          href="/points"
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          تاریخچه امتیاز
          <ChevronLeft className="size-3.5" />
        </Link>
      </div>

      <div className="space-y-2 px-6">
        <Progress value={percent} aria-label="پیشرفت تا سطح بعدی" />
        <p className="text-xs text-muted-foreground">
          {pointsToNextLevel !== null && level.nextLevel
            ? `${toPersianDigits(pointsToNextLevel)} امتیاز تا سطح «${level.nextLevel}»`
            : "شما به بالاترین سطح رسیده‌اید."}
        </p>
      </div>
    </Card>
  );
}
