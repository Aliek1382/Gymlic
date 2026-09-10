"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteRevenueEntry } from "../services/revenue-service";

export function useDeleteRevenueEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteRevenueEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club-revenue"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
