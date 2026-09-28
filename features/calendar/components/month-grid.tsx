"use client";

import Link from "next/link";
import { CalendarCheck, Pin } from "lucide-react";

import { cn } from "@/lib/utils";
import { toPersianDigits } from "@/lib/persian";
import { WEEKDAYS, type MonthGrid } from "../utils/month-grid";
import type { CalendarEvent } from "../types/calendar-types";

const CHIP_BASE =
  "flex w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[11px] leading-tight";

function EventChip({
  event,
  onSelect,
}: {
  event: CalendarEvent;
  onSelect: (event: CalendarEvent) => void;
}) {
  const label = (
    <>
      {event.source === "auto" ? (
        <CalendarCheck className="size-3 shrink-0" />
      ) : (
        <Pin className="size-3 shrink-0" />
      )}
      <span className="truncate">
        {event.startTime && <>{toPersianDigits(event.startTime)} </>}
        {event.title}
      </span>
    </>
  );
  const title = event.athleteName ? `${event.title} — ${event.athleteName}` : event.title;

  // A session belongs to its package, which is managed on the athlete's profile — not edited here.
  if (event.source === "auto") {
    const className = cn(CHIP_BASE, "bg-primary/15 text-primary");
    return event.athleteId ? (
      <Link
        href={`/athletes/profile?id=${event.athleteId}`}
        title={title}
        className={cn(className, "hover:bg-primary/25")}
        onClick={(e) => e.stopPropagation()}
      >
        {label}
      </Link>
    ) : (
      <span title={title} className={className}>
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      title={title}
      className={cn(CHIP_BASE, "bg-secondary text-secondary-foreground hover:bg-secondary/70")}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(event);
      }}
    >
      {label}
    </button>
  );
}

export function MonthGridView({
  grid,
  eventsByDate,
  todayIso,
  onSelectDay,
  onSelectEvent,
}: {
  grid: MonthGrid;
  eventsByDate: Map<string, CalendarEvent[]>;
  /** Gregorian ISO of today, to highlight the cell; only matched, never shown. */
  todayIso: string;
  onSelectDay: (iso: string) => void;
  onSelectEvent: (event: CalendarEvent) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="grid grid-cols-7 border-b border-border bg-muted/50">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="px-1 py-2 text-center text-[11px] font-medium text-muted-foreground sm:text-xs"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {Array.from({ length: grid.leadingBlanks }, (_, i) => (
          <div key={`blank-${i}`} className="min-h-20 border-b border-e border-border bg-muted/20 sm:min-h-28" />
        ))}

        {grid.days.map((day) => {
          const events = eventsByDate.get(day.iso) ?? [];
          return (
            <div
              key={day.iso}
              role="button"
              tabIndex={0}
              aria-label={`رویداد جدید در روز ${toPersianDigits(day.jd)}`}
              onClick={() => onSelectDay(day.iso)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectDay(day.iso);
                }
              }}
              className={cn(
                "min-h-20 cursor-pointer space-y-1 border-b border-e border-border p-1 text-start transition-colors hover:bg-muted/40 sm:min-h-28 sm:p-1.5",
                day.iso === todayIso && "bg-primary/5"
              )}
            >
              <span
                className={cn(
                  "inline-flex size-6 items-center justify-center rounded-full text-xs",
                  day.iso === todayIso
                    ? "bg-primary font-bold text-primary-foreground"
                    : "text-foreground"
                )}
              >
                {toPersianDigits(day.jd)}
              </span>
              <div className="space-y-0.5">
                {events.map((event) => (
                  <EventChip key={`${event.id}-${event.date}`} event={event} onSelect={onSelectEvent} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
