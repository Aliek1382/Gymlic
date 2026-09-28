"use client";

import { useQuery } from "@tanstack/react-query";

import { listCalendarEvents } from "../services/calendar-service";

/** One Jalali month; the key carries jy/jm so each month is cached on its own. */
export function useCalendarEvents(jy: number, jm: number, from: string, to: string) {
  return useQuery({
    queryKey: ["calendar", "events", jy, jm],
    queryFn: () => listCalendarEvents(from, to),
  });
}
