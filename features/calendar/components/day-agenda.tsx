"use client";

import Link from "next/link";
import { CalendarCheck, Pin, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatPersianDate, toPersianDigits } from "@/lib/persian";
import { parseIsoDate } from "@/lib/iso-date";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "../types/calendar-types";

function AgendaRow({ event, onEdit }: { event: CalendarEvent; onEdit: (event: CalendarEvent) => void }) {
  const isAuto = event.source === "auto";
  const body = (
    <>
      <span
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
          isAuto ? "bg-primary/15 text-primary" : "bg-secondary text-secondary-foreground"
        )}
      >
        {isAuto ? <CalendarCheck className="size-4" /> : <Pin className="size-4" />}
      </span>
      <span className="min-w-0 flex-1 text-start">
        <span className="flex items-baseline gap-2">
          {event.startTime && (
            <span className="shrink-0 text-xs font-medium text-muted-foreground">{toPersianDigits(event.startTime)}</span>
          )}
          <span className="break-words text-sm font-medium text-foreground">{event.title}</span>
        </span>
        {event.athleteName && <span className="block text-xs text-muted-foreground">{event.athleteName}</span>}
        {event.notes && (
          <span className="mt-1 block whitespace-pre-line break-words text-xs leading-5 text-muted-foreground line-clamp-3">
            {event.notes}
          </span>
        )}
      </span>
    </>
  );

  const className = "flex w-full items-start gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-muted/40";

  // A session belongs to its package, managed on the athlete's profile; a manual event is edited here.
  if (isAuto) {
    return event.athleteId ? (
      <Link href={`/athletes/profile?id=${event.athleteId}`} className={className}>
        {body}
      </Link>
    ) : (
      <div className={className}>{body}</div>
    );
  }
  return (
    <button type="button" className={className} onClick={() => onEdit(event)}>
      {body}
    </button>
  );
}

/** Phone view: the picked day's events in full, since the grid cell can only hold dots. */
export function DayAgenda({
  dateIso,
  events,
  onNew,
  onEdit,
}: {
  dateIso: string;
  events: CalendarEvent[];
  onNew: () => void;
  onEdit: (event: CalendarEvent) => void;
}) {
  return (
    <section className="space-y-3 sm:hidden" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-foreground">{formatPersianDate(parseIsoDate(dateIso))}</h3>
        <Button size="sm" onClick={onNew}>
          <Plus />
          رویداد جدید
        </Button>
      </div>

      {events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          رویدادی برای این روز ثبت نشده است.
        </p>
      ) : (
        <ul className="space-y-2">
          {events.map((event, index) => (
            <li key={`${event.id}-${index}`}>
              <AgendaRow event={event} onEdit={onEdit} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
