"use client";

import { useQuery } from "@tanstack/react-query";

import { listDayLogsSince } from "../services/workout-log-service";
import { calendarWindowStart } from "../utils/training-calendar";

// Fetches exactly the window the calendar renders. Keyed by that window's
// start date, so the cache rolls over on its own once a new week begins.
export function useTrainingHistory(athleteId: string, weekCount: number) {
  const fromDate = calendarWindowStart(weekCount);

  return useQuery({
    queryKey: ["athletes", "day-logs", "history", athleteId, fromDate],
    queryFn: () => listDayLogsSince(fromDate, athleteId),
  });
}
