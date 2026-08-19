"use client";

import { useQuery } from "@tanstack/react-query";

import { getPersianWeekStart, toDateKey } from "@/features/athletes";
import { listWeeklyAdherence } from "../services/report-service";

// Keyed by the week's start date so the cache rolls over on its own when the
// week does, rather than showing last week's counts.
export function useWeeklyAdherence() {
  const weekStart = toDateKey(getPersianWeekStart());

  return useQuery({
    queryKey: ["reports", "weekly-adherence", weekStart],
    queryFn: listWeeklyAdherence,
  });
}
