"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { removeTrainer } from "../services/trainer-service";

export function useRemoveTrainer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeTrainer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club-trainers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
