"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createTrainerInvite } from "../services/trainer-service";

export function useCreateTrainerInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTrainerInvite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club-trainers"] });
    },
  });
}
