"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateRevenueEntry } from "../services/revenue-service";
import type { RevenueEntryInput } from "../types/revenue-types";

export function useUpdateRevenueEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: RevenueEntryInput }) =>
      updateRevenueEntry(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club-revenue"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
