"use client";

import Link from "next/link";
import { CalendarCheck, Pin } from "lucide-react";

import { cn } from "@/lib/utils";
import { toPersianDigits } from "@/lib/persian";
import { WEEKDAYS, WEEKDAYS_SHORT, type MonthGrid } from "../utils/month-grid";
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
  const heading = event.athleteName ? `${event.title} — ${event.athleteName}` : event.title;
  const title = event.notes ? `${heading}\n${event.notes}` : heading;

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

const MAX_DOTS = 3;

/** Phones: a dot per event (a chip's text can't fit in a ~48px cell). */
function EventDots({ events }: { events: CalendarEvent[] }) {
  if (events.length === 0) return null;
  return (
    <div className="flex items-center justify-center gap-0.5 sm:hidden" aria-hidden>
      {events.slice(0, MAX_DOTS).map((event, index) => (
        <span
          key={`${event.id}-${index}`}
          className={cn("size-1.5 rounded-full", event.source === "auto" ? "bg-primary" : "bg-muted-foreground")}
        />
      ))}
      {events.length > MAX_DOTS && (
        <span className="text-[9px] leading-none text-muted-foreground">+</span>
      )}
    </div>
  );
}

export function MonthGridView({
  grid,
  eventsByDate,
  todayIso,
  selectedIso,
  onSelectDay,
  onSelectEvent,
}: {
  grid: MonthGrid;
  eventsByDate: Map<string, CalendarEvent[]>;
  /** Gregorian ISO of today, to highlight the cell; only matched, never shown. */
  todayIso: string;
  /** The day picked on a phone, whose events are listed under the grid. */
  selectedIso: string | null;
  onSelectDay: (iso: string) => void;
  onSelectEvent: (event: CalendarEvent) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="grid grid-cols-7 border-b border-border bg-muted/50">
        {WEEKDAYS.map((day, index) => (
          <div key={day} className="px-0.5 py-2 text-center text-xs font-medium text-muted-foreground">
            <span className="sm:hidden">{WEEKDAYS_SHORT[index]}</span>
            <span className="hidden sm:inline">{day}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {Array.from({ length: grid.leadingBlanks }, (_, i) => (
          <div key={`blank-${i}`} className="h-14 border-b border-e border-border bg-muted/20 sm:h-auto sm:min-h-28" />
        ))}

        {grid.days.map((day) => {
          const events = eventsByDate.get(day.iso) ?? [];
          const isToday = day.iso === todayIso;
          const isSelected = day.iso === selectedIso;
          return (
            <div
              key={day.iso}
              role="button"
              tabIndex={0}
              aria-label={`روز ${toPersianDigits(day.jd)}${events.length ? `، ${toPersianDigits(events.length)} رویداد` : ""}`}
              aria-pressed={isSelected}
              onClick={() => onSelectDay(day.iso)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectDay(day.iso);
                }
              }}
              className={cn(
                "flex h-14 min-w-0 cursor-pointer flex-col items-center gap-1 border-b border-e border-border p-1 transition-colors hover:bg-muted/40",
                "sm:h-auto sm:min-h-28 sm:items-stretch sm:gap-1 sm:p-1.5",
                isToday && "bg-primary/5",
                isSelected && "bg-primary/10 ring-2 ring-inset ring-primary sm:bg-transparent sm:ring-0"
              )}
            >
              <span
                className={cn(
                  "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs",
                  isToday ? "bg-primary font-bold text-primary-foreground" : "text-foreground"
                )}
              >
                {toPersianDigits(day.jd)}
              </span>

              <EventDots events={events} />

              <div className="hidden min-w-0 space-y-0.5 sm:block">
                {events.map((event, index) => (
                  <EventChip key={`${event.id}-${event.date}-${index}`} event={event} onSelect={onSelectEvent} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
