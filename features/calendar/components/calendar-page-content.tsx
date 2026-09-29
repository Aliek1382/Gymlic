"use client";

import { useMemo, useState } from "react";
import { CalendarCheck, ChevronLeft, ChevronRight, Pin, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/features/dashboard/components/shared/error-state";
import { PushToggle } from "@/features/push";
import { todayIso } from "@/lib/iso-date";
import {
  PERSIAN_MONTH_NAMES,
  getJalaliParts,
  toPersianDigits,
} from "@/lib/persian";
import { useCalendarEvents } from "../hooks/use-calendar-events";
import type { CalendarEvent } from "../types/calendar-types";
import { buildMonthGrid, shiftMonth } from "../utils/month-grid";
import { EventDialog, type EventDialogTarget } from "./event-dialog";
import { MonthGridView } from "./month-grid";

export function CalendarPageContent() {
  const [month, setMonth] = useState(() => {
    const { jy, jm } = getJalaliParts(new Date());
    return { jy, jm };
  });
  const [dialog, setDialog] = useState<EventDialogTarget | null>(null);

  const grid = useMemo(() => buildMonthGrid(month.jy, month.jm), [month]);
  const events = useCalendarEvents(month.jy, month.jm, grid.from, grid.to);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events.data ?? []) {
      map.set(event.date, [...(map.get(event.date) ?? []), event]);
    }
    return map;
  }, [events.data]);

  const isCurrentMonth = (() => {
    const now = getJalaliParts(new Date());
    return now.jy === month.jy && now.jm === month.jm;
  })();

  return (
    <div className="space-y-4">
      <PushToggle />

      <Card className="gap-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* The page is RTL: "previous" points right, "next" left. */}
            <Button
              variant="outline"
              size="icon"
              aria-label="ماه قبل"
              onClick={() => setMonth((m) => shiftMonth(m.jy, m.jm, -1))}
            >
              <ChevronRight />
            </Button>
            <h2 className="min-w-32 text-center text-base font-bold text-foreground">
              {PERSIAN_MONTH_NAMES[month.jm - 1]} {toPersianDigits(month.jy)}
            </h2>
            <Button
              variant="outline"
              size="icon"
              aria-label="ماه بعد"
              onClick={() => setMonth((m) => shiftMonth(m.jy, m.jm, 1))}
            >
              <ChevronLeft />
            </Button>
            {!isCurrentMonth && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const { jy, jm } = getJalaliParts(new Date());
                  setMonth({ jy, jm });
                }}
              >
                امروز
              </Button>
            )}
          </div>

          <Button onClick={() => setDialog({ date: todayIso() })}>
            <Plus />
            رویداد جدید
          </Button>
        </div>

        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarCheck className="size-3.5 text-primary" />
            جلسه‌ی خصوصی (خودکار)
          </span>
          <span className="flex items-center gap-1">
            <Pin className="size-3.5" />
            رویداد دستی
          </span>
        </div>

        {events.isLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : events.isError ? (
          <ErrorState message="خطا در دریافت رویدادهای تقویم" />
        ) : (
          <MonthGridView
            grid={grid}
            eventsByDate={eventsByDate}
            todayIso={todayIso()}
            onSelectDay={(date) => setDialog({ date })}
            onSelectEvent={(event) => setDialog({ event })}
          />
        )}
      </Card>

      <EventDialog target={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}
