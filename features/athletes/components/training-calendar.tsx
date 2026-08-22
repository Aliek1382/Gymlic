"use client";

import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";

import { Card, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPersianDate, toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { useTrainingHistory } from "../hooks/use-training-history";
import { buildTrainingCalendar, type CalendarDay } from "../utils/training-calendar";
import { WEEKDAYS } from "../utils/workout-plan-text";

const WEEK_COUNT = 12;

// Weekday initials for the column headers — "ش" for شنبه, "۱ش" for یکشنبه —
// so the grid stays narrow enough for a phone.
const WEEKDAY_INITIALS = ["ش", "۱ش", "۲ش", "۳ش", "۴ش", "۵ش", "ج"];

function dayTitle(day: CalendarDay): string {
  const date = formatPersianDate(day.date);
  if (day.sessions.length === 0) return date;
  return `${date} — ${day.sessions.join("، ")}`;
}

function DayCell({ day }: { day: CalendarDay }) {
  const trained = day.sessions.length > 0;

  return (
    <div
      title={dayTitle(day)}
      className={cn(
        "flex aspect-square items-center justify-center rounded-md border text-[10px] font-medium",
        day.isFuture
          ? "border-dashed border-border/60 text-muted-foreground/40"
          : trained
            ? "border-transparent bg-primary text-primary-foreground"
            : "border-border bg-muted/40 text-muted-foreground",
        day.isToday && "ring-2 ring-primary ring-offset-1 ring-offset-background"
      )}
    >
      {/* More than one block ticked that day, so the count carries information
          a filled square alone would lose. */}
      {trained && day.sessions.length > 1
        ? toPersianDigits(day.sessions.length)
        : ""}
    </div>
  );
}

export function TrainingCalendar({ athleteId }: { athleteId: string }) {
  const history = useTrainingHistory(athleteId, WEEK_COUNT);

  // Built after mount: the grid is anchored on "today", which the server
  // (UTC) and the browser (local) can disagree about.
  const [calendar, setCalendar] = useState<ReturnType<
    typeof buildTrainingCalendar
  > | null>(null);

  useEffect(() => {
    if (history.data) setCalendar(buildTrainingCalendar(history.data, WEEK_COUNT));
  }, [history.data]);

  if (history.isLoading || (history.data && !calendar)) {
    return <Skeleton className="h-72 w-full rounded-2xl" />;
  }

  if (history.isError) {
    return (
      <Card className="border-destructive/30 py-5">
        <p className="px-6 text-sm text-destructive">
          دریافت تاریخچه تمرین با خطا مواجه شد.
        </p>
      </Card>
    );
  }

  if (!calendar) return null;

  return (
    <Card className="gap-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-2 px-6">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">تقویم تمرین</CardTitle>
        </div>
        <span className="text-xs text-muted-foreground">
          {toPersianDigits(WEEK_COUNT)} هفته گذشته
        </span>
      </div>

      {calendar.totalSessions === 0 ? (
        <div className="px-6">
          <EmptyState
            icon={CalendarDays}
            title="هنوز تمرینی ثبت نشده است."
            description="هر روزی که در برنامه تمرینی «انجام دادم» را بزنید، اینجا ثبت می‌شود."
          />
        </div>
      ) : (
        <div className="space-y-4 px-6">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span>
              روزهای تمرین:{" "}
              <span className="font-bold text-foreground">
                {toPersianDigits(calendar.activeDays)}
              </span>
            </span>
            <span>
              مجموع جلسات:{" "}
              <span className="font-bold text-foreground">
                {toPersianDigits(calendar.totalSessions)}
              </span>
            </span>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[280px] space-y-1">
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAY_INITIALS.map((initial, index) => (
                  <span
                    key={WEEKDAYS[index]}
                    title={WEEKDAYS[index]}
                    className="text-center text-[10px] font-medium text-muted-foreground"
                  >
                    {initial}
                  </span>
                ))}
              </div>

              {calendar.weeks.map((week) => (
                <div key={week.startDateKey} className="grid grid-cols-7 gap-1">
                  {week.days.map((day) => (
                    <DayCell key={day.dateKey} day={day} />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded-md bg-primary" />
              تمرین ثبت‌شده
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded-md border border-border bg-muted/40" />
              بدون تمرین
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
