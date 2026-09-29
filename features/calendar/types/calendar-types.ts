export type CalendarEventSource = "auto" | "manual";

export interface CalendarEvent {
  id: string;
  title: string;
  /** Free-text checklist/notes the trainer attached, or null. */
  notes: string | null;
  athleteId: string | null;
  athleteName: string | null;
  /** The day this occurrence falls on, Gregorian "YYYY-MM-DD" (converted to Jalali only when drawn). */
  date: string;
  /** Where the event itself starts — for a recurring one, the series' first day. */
  eventDate: string;
  /** "HH:MM" or null. */
  startTime: string | null;
  /** Minutes before startTime a notification goes out (10, 30, 60, 1440), or null for none. */
  remindBeforeMinutes: number | null;
  /** PHP weekday numbers, 0 = Sunday ("1,3,5"), or null for a one-off. */
  recurrenceRule: string | null;
  recurrenceUntil: string | null;
  isRecurring: boolean;
  source: CalendarEventSource;
}

export interface CalendarEventInput {
  title: string;
  notes: string | null;
  athleteId: string | null;
  eventDate: string;
  startTime: string | null;
  remindBeforeMinutes: number | null;
  recurrenceRule: string | null;
  recurrenceUntil: string | null;
}

/** The lead times a reminder can have — mirrors the API's allowed values. */
export const REMINDER_OPTIONS = [
  { minutes: 10, label: "۱۰ دقیقه قبل" },
  { minutes: 30, label: "۳۰ دقیقه قبل" },
  { minutes: 60, label: "۱ ساعت قبل" },
  { minutes: 1440, label: "۱ روز قبل" },
] as const;
