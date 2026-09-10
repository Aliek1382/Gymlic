"use client";

import { Flame } from "lucide-react";

import { Card, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toPersianDigits } from "@/lib/persian";
import {
  STREAK_MIN_SESSIONS,
  computeWeekStreak,
  parsePlanDescription,
  useTrainingHistory,
  useWorkoutDayLogs,
} from "@/features/athletes";
import type { AthletePlanSummary } from "../../types/dashboard-types";

// Matches the window the trainer's per-athlete calendar and the athlete's own
// /progress page use, so the streak shown here never disagrees with either.
const STREAK_WEEKS = 12;

// The trainer's athlete list already surfaces this streak at a glance; the
// athlete themself — who this is actually meant to motivate — previously had
// to open /progress to see it. This mirrors that same badge on their own
// dashboard home.
export function StreakCard({
  athleteId,
  todaysWorkout,
}: {
  athleteId: string;
  todaysWorkout: AthletePlanSummary | null;
}) {
  const history = useTrainingHistory(athleteId, STREAK_WEEKS);
  const weekLogs = useWorkoutDayLogs(Boolean(todaysWorkout));

  if (history.isLoading) {
    return <Skeleton className="h-28 w-full rounded-2xl" />;
  }

  const streak = computeWeekStreak(history.data ?? []);

  // Only headed sections are tickable — the heading is the day's key, same
  // rule the plan card itself ticks against.
  const sessionsPerWeek = todaysWorkout
    ? parsePlanDescription(todaysWorkout.description).filter(
        (section) => section.heading !== null
      ).length
    : 0;
  const hasGoal = sessionsPerWeek > 0;
  const doneThisWeek = todaysWorkout
    ? new Set(
        (weekLogs.data ?? [])
          .filter((log) => log.assignmentId === todaysWorkout.id)
          .map((log) => log.dayKey)
      ).size
    : 0;
  const percent = hasGoal ? Math.round((doneThisWeek / sessionsPerWeek) * 100) : 0;

  return (
    <Card className="gap-4 py-5">
      <div className="flex items-center gap-2 px-6">
        <Flame className="size-4 text-muted-foreground" />
        <CardTitle className="text-base">پایبندی شما</CardTitle>
      </div>

      <div className="space-y-3 px-6">
        {streak.current > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-primary/10 px-3 py-2">
            <Flame className="size-4 shrink-0 text-primary" />
            <span className="text-sm font-bold text-foreground">
              {toPersianDigits(streak.current)} هفته پیاپی
            </span>
            <span className="text-xs text-muted-foreground">
              {streak.best > streak.current
                ? `بهترین رکورد شما ${toPersianDigits(streak.best)} هفته بوده است.`
                : "این بهترین رکورد شماست."}
            </span>
          </div>
        ) : (
          <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
            هفته‌ای حداقل {toPersianDigits(STREAK_MIN_SESSIONS)} جلسه تمرین
            کنید تا استریک شما شروع شود.
          </p>
        )}

        {hasGoal && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              {toPersianDigits(doneThisWeek)} از {toPersianDigits(sessionsPerWeek)}{" "}
              جلسه‌ی این هفته
            </p>
            <Progress value={Math.min(100, percent)} />
          </div>
        )}
      </div>
    </Card>
  );
}
