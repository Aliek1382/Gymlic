"use client";

import { useQuery } from "@tanstack/react-query";

import { listWorkoutPlanDays } from "../services/workout-plan-builder-service";

export function workoutPlanDaysKey(assignmentId: string) {
  return ["athletes", "workout-plan-days", assignmentId];
}

export function useWorkoutPlanDays(assignmentId: string | null) {
  return useQuery({
    queryKey: workoutPlanDaysKey(assignmentId ?? ""),
    queryFn: () => listWorkoutPlanDays(assignmentId as string),
    enabled: assignmentId !== null,
  });
}
