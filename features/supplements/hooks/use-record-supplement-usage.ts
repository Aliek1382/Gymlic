"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { recordSupplementUsage } from "../services/supplement-service";

export function useRecordSupplementUsage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: recordSupplementUsage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplements", "picker"] });
    },
  });
}
