"use client";

import { useQuery } from "@tanstack/react-query";

import { listDayLogsSince } from "../services/workout-log-service";
import { getPersianWeekStart, toDateKey } from "../utils/workout-plan-weekday";

// Keyed by the week's start date, so every plan card asking for this week's
// logs shares one request — and the cache rolls over on its own when the
// week does.
export function useWorkoutDayLogs(enabled = true) {
  const weekStart = toDateKey(getPersianWeekStart());

  return useQuery({
    queryKey: ["athletes", "day-logs", weekStart],
    queryFn: () => listDayLogsSince(weekStart),
    enabled,
  });
}
