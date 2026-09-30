"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createSupplement } from "../services/supplement-service";

export function useCreateSupplement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSupplement,
    onSuccess: () => {
      // The library page and the picker both list the new supplement.
      queryClient.invalidateQueries({ queryKey: ["supplements"] });
    },
  });
}
