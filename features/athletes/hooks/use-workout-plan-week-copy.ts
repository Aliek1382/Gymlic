"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { copyWorkoutPlanWeek } from "../services/workout-plan-builder-service";
import { workoutPlanDaysKey } from "./use-workout-plan-days";

export function useWorkoutPlanWeekCopy(assignmentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { sourceWeekNumber: number; targetWeekNumber: number }) =>
      copyWorkoutPlanWeek(assignmentId, input.sourceWeekNumber, input.targetWeekNumber),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: workoutPlanDaysKey(assignmentId) }),
  });
}
