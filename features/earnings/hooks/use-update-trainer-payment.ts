"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateTrainerPayment } from "../services/earnings-service";
import type { TrainerPaymentInput } from "../types/earnings-types";

export function useUpdateTrainerPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TrainerPaymentInput }) =>
      updateTrainerPayment(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["earnings"] });
    },
  });
}
