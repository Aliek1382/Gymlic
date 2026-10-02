"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createExercise } from "../services/exercise-service";

export function useCreateExercise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createExercise,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercises", "list"] });
      // The "4 of 5 custom exercises" line reads the trainer's limits.
      queryClient.invalidateQueries({ queryKey: ["trainer-billing"] });
    },
  });
}
