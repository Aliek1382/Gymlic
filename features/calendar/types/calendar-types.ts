export type CalendarEventSource = "auto" | "manual";

export interface CalendarEvent {
  id: string;
  title: string;
  athleteId: string | null;
  athleteName: string | null;
  /** The day this occurrence falls on, Gregorian "YYYY-MM-DD" (converted to Jalali only when drawn). */
  date: string;
  /** Where the event itself starts — for a recurring one, the series' first day. */
  eventDate: string;
  /** "HH:MM" or null. */
  startTime: string | null;
  /** PHP weekday numbers, 0 = Sunday ("1,3,5"), or null for a one-off. */
  recurrenceRule: string | null;
  recurrenceUntil: string | null;
  isRecurring: boolean;
  source: CalendarEventSource;
}

export interface CalendarEventInput {
  title: string;
  athleteId: string | null;
  eventDate: string;
  startTime: string | null;
  recurrenceRule: string | null;
  recurrenceUntil: string | null;
}
