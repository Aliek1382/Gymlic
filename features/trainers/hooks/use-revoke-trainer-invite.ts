"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { revokeTrainerInvite } from "../services/trainer-service";

export function useRevokeTrainerInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: revokeTrainerInvite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club-trainers"] });
    },
  });
}
