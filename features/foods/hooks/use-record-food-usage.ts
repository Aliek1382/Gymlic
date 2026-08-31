"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { recordFoodUsage } from "../services/food-service";

export function useRecordFoodUsage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: recordFoodUsage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["foods", "picker"] });
    },
  });
}
