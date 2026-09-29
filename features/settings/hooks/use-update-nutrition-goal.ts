"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateNutritionGoal } from "../services/settings-service";

export function useUpdateNutritionGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateNutritionGoal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "profile"] });
    },
  });
}
