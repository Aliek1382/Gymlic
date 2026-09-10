"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createFood } from "../services/food-service";

export function useCreateFood() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createFood,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["foods", "list"] });
    },
  });
}
