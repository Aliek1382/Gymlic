"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateAthleteNutritionGoal } from "../services/athlete-service";

export function useUpdateAthleteNutritionGoal(athleteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (goal: Parameters<typeof updateAthleteNutritionGoal>[1]) =>
      updateAthleteNutritionGoal(athleteId, goal),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["athletes", "profile", athleteId] });
    },
  });
}
