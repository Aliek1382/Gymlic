"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  deleteWorkoutDayLog,
  logWorkoutDay,
} from "../services/workout-log-service";
import { getPersianWeekStart, toDateKey } from "../utils/workout-plan-weekday";

// Ticks a day for today, or clears the tick when `existingLogId` is given —
// the caller already knows whether this week holds a log for the day.
export function useToggleWorkoutDay(assignmentId: string) {
  const queryClient = useQueryClient();
  const weekStart = toDateKey(getPersianWeekStart());

  return useMutation({
    mutationFn: ({
      dayKey,
      existingLogId,
    }: {
      dayKey: string;
      existingLogId: string | null;
    }) =>
      existingLogId
        ? deleteWorkoutDayLog(existingLogId)
        : logWorkoutDay(assignmentId, dayKey, toDateKey(new Date())),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["athletes", "day-logs", weekStart] });
    },
  });
}
