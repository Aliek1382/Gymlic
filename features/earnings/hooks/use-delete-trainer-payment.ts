"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteTrainerPayment } from "../services/earnings-service";

export function useDeleteTrainerPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTrainerPayment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["earnings"] });
    },
  });
}
