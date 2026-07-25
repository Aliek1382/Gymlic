"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { revokeAthleteInvite } from "../services/athlete-service";

export function useRevokeAthleteInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: revokeAthleteInvite,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["athletes", "pending-invites"],
      });
    },
  });
}
