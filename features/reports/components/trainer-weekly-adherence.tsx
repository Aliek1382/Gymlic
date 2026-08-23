"use client";

import { CalendarCheck, Flame, Users } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toPersianDigits } from "@/lib/persian";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { useWeeklyAdherence } from "../hooks/use-weekly-adherence";
import { STREAK_MIN_SESSIONS } from "@/features/athletes";
import { byNeedsAttention } from "../utils/adherence";
import type { AthleteWeeklyAdherence } from "../types/report-types";

function AthleteRow({ athlete }: { athlete: AthleteWeeklyAdherence }) {
  const hasPlan = athlete.sessionsPerWeek > 0;
  const percent = hasPlan
    ? Math.round((athlete.doneThisWeek / athlete.sessionsPerWeek) * 100)
    : 0;
  const isComplete = hasPlan && athlete.doneThisWeek >= athlete.sessionsPerWeek;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border p-4">
      <Avatar className="size-9 shrink-0">
        <AvatarFallback className="text-xs">
          {athlete.name.slice(0, 2)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-foreground">
            {athlete.name}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            {athlete.streakWeeks > 0 && (
              <span
                title={`${athlete.streakWeeks} هفته پیاپی، حداقل ${STREAK_MIN_SESSIONS} جلسه در هفته`}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
              >
                <Flame className="size-3" />
                {toPersianDigits(athlete.streakWeeks)}
              </span>
            )}
            {isComplete && <Badge variant="success">کامل</Badge>}
          </div>
        </div>

        {hasPlan ? (
          <>
            <p className="text-xs text-muted-foreground">
              {toPersianDigits(athlete.doneThisWeek)} از{" "}
              {toPersianDigits(athlete.sessionsPerWeek)} جلسه‌ی این هفته
            </p>
            <Progress value={Math.min(100, percent)} />
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            برنامه‌ی تمرینی فعالی ندارد.
          </p>
        )}
      </div>
    </div>
  );
}

export function TrainerWeeklyAdherence() {
  const adherence = useWeeklyAdherence();

  if (adherence.isLoading) {
    return (
      <Card className="gap-4 py-5">
        <div className="space-y-2 px-6">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </Card>
    );
  }

  if (adherence.isError) {
    return (
      <Card className="border-destructive/30 py-5">
        <p className="px-6 text-sm text-destructive">
          دریافت پایبندی هفتگی ورزشکاران با خطا مواجه شد.
        </p>
      </Card>
    );
  }

  if (!adherence.data || adherence.data.length === 0) {
    return (
      <Card className="py-5">
        <EmptyState
          icon={Users}
          title="هنوز ورزشکاری ثبت نشده است."
          description="بعد از افزودن ورزشکار، پایبندی هفتگی آن‌ها اینجا نمایش داده می‌شود."
        />
      </Card>
    );
  }

  const sorted = [...adherence.data].sort(byNeedsAttention);

  return (
    <Card className="gap-4 py-5">
      <div className="flex items-center gap-2 px-6">
        <CalendarCheck className="size-4 text-muted-foreground" />
        <CardTitle className="text-base">پایبندی این هفته</CardTitle>
      </div>
      <p className="px-6 text-xs text-muted-foreground">
        جلسه‌هایی که هر ورزشکار از برنامه‌ی فعال خود در هفته‌ی جاری (شنبه تا
        جمعه) انجام داده است. ورزشکارانی که بیشتر عقب‌اند بالاتر نمایش
        داده می‌شوند.
      </p>
      <div className="space-y-2 px-6">
        {sorted.map((athlete) => (
          <AthleteRow key={athlete.athleteId} athlete={athlete} />
        ))}
      </div>
    </Card>
  );
}
