"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  copyWorkoutPlanDay,
  createWorkoutPlanDay,
  deleteWorkoutPlanDay,
  updateWorkoutPlanDay,
} from "../services/workout-plan-builder-service";
import { workoutPlanDaysKey } from "./use-workout-plan-days";

/** Create/rename/delete/copy a day — every call invalidates the same day list so a
 *  trainer's next read (or the next autosave) always sees the current state. */
export function useWorkoutPlanDayActions(assignmentId: string) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: workoutPlanDaysKey(assignmentId) });

  const createDay = useMutation({
    mutationFn: (input: { weekNumber: number; dayNumber: number; dayName: string | null }) =>
      createWorkoutPlanDay(assignmentId, input),
    onSuccess: invalidate,
  });

  const renameDay = useMutation({
    mutationFn: (input: {
      dayId: string;
      dayName?: string | null;
      dayNumber?: number;
      weekNumber?: number;
    }) => updateWorkoutPlanDay(assignmentId, input.dayId, input),
    onSuccess: invalidate,
  });

  const removeDay = useMutation({
    mutationFn: (dayId: string) => deleteWorkoutPlanDay(assignmentId, dayId),
    onSuccess: invalidate,
  });

  const copyDay = useMutation({
    mutationFn: (input: { dayId: string; dayNumber: number; weekNumber: number }) =>
      copyWorkoutPlanDay(assignmentId, input.dayId, input),
    onSuccess: invalidate,
  });

  return { createDay, renameDay, removeDay, copyDay };
}
