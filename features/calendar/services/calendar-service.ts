import { api, fullName, query, type ListResponse } from "@/lib/api/client";
import type { CalendarEvent, CalendarEventInput, CalendarEventSource } from "../types/calendar-types";

interface EventRow {
  id: string;
  title: string;
  athlete_id: string | null;
  athlete_first_name: string | null;
  athlete_last_name: string | null;
  date: string;
  event_date: string;
  start_time: string | null;
  recurrence_rule: string | null;
  recurrence_until: string | null;
  is_recurring: boolean;
  source: CalendarEventSource;
}

function toEvent(row: EventRow): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    athleteId: row.athlete_id,
    athleteName: row.athlete_id
      ? fullName(row.athlete_first_name, row.athlete_last_name, "ورزشکار")
      : null,
    date: row.date,
    eventDate: row.event_date,
    startTime: row.start_time,
    recurrenceRule: row.recurrence_rule,
    recurrenceUntil: row.recurrence_until,
    isRecurring: row.is_recurring,
    source: row.source,
  };
}

function toPayload(input: CalendarEventInput) {
  return {
    title: input.title,
    athlete_id: input.athleteId,
    event_date: input.eventDate,
    start_time: input.startTime,
    recurrence_rule: input.recurrenceRule,
    recurrence_until: input.recurrenceUntil,
  };
}

/** `from`/`to` are Gregorian "YYYY-MM-DD"; the API expands recurring events inside them. */
export async function listCalendarEvents(from: string, to: string): Promise<CalendarEvent[]> {
  const data = await api.get<ListResponse<EventRow>>(`/calendar/events${query({ from, to })}`);
  return data.items.map(toEvent);
}

export async function createCalendarEvent(input: CalendarEventInput): Promise<void> {
  await api.post("/calendar/events", toPayload(input));
}

export async function updateCalendarEvent(id: string, input: CalendarEventInput): Promise<void> {
  await api.patch(`/calendar/events/${id}`, toPayload(input));
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  await api.delete(`/calendar/events/${id}`);
}
