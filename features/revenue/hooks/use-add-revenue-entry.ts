"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { addRevenueEntry } from "../services/revenue-service";
import type { RevenueEntryInput } from "../types/revenue-types";

export function useAddRevenueEntry(clubId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RevenueEntryInput) => addRevenueEntry(clubId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club-revenue"] });
      // The dashboard's revenue card, sparkline and chart read the same rows.
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
