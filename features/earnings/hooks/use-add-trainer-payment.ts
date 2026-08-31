"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { addTrainerPayment } from "../services/earnings-service";
import type { TrainerPaymentInput } from "../types/earnings-types";

export function useAddTrainerPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TrainerPaymentInput) => addTrainerPayment(input),
    // One payment moves the ledger, the summary cards and the trend chart,
    // so invalidate the whole feature key rather than listing each query.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["earnings"] });
    },
  });
}
