"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { recordExerciseUsage } from "../services/exercise-service";

export function useRecordExerciseUsage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: recordExerciseUsage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercises", "picker"] });
    },
  });
}
