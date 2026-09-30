"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  addWorkoutPlanExercise,
  deleteWorkoutPlanExercise,
  updateWorkoutPlanExercise,
} from "../services/workout-plan-builder-service";
import { workoutPlanDaysKey } from "./use-workout-plan-days";

export function useWorkoutPlanExerciseActions(assignmentId: string) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: workoutPlanDaysKey(assignmentId) });

  const addExercise = useMutation({
    mutationFn: (input: {
      dayId: string;
      exerciseId: string;
      sets: number | null;
      reps: string | null;
      weightKg: number | null;
      restSeconds: number | null;
      note: string | null;
      techniqueId: string | null;
    }) => addWorkoutPlanExercise(assignmentId, input.dayId, input),
    onSuccess: invalidate,
  });

  // No invalidation on success: a field the trainer is still typing into
  // would otherwise be clobbered by the refetch it triggers. The list is
  // refreshed on the next mount/day-change instead.
  const updateExercise = useMutation({
    mutationFn: (input: {
      dayId: string;
      exerciseRowId: string;
      sets?: number | null;
      reps?: string | null;
      weightKg?: number | null;
      restSeconds?: number | null;
      note?: string | null;
      techniqueId?: string | null;
    }) => updateWorkoutPlanExercise(assignmentId, input.dayId, input.exerciseRowId, input),
  });

  const removeExercise = useMutation({
    mutationFn: (input: { dayId: string; exerciseRowId: string }) =>
      deleteWorkoutPlanExercise(assignmentId, input.dayId, input.exerciseRowId),
    onSuccess: invalidate,
  });

  return { addExercise, updateExercise, removeExercise };
}
