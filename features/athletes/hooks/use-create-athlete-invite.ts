"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createAthleteInvite } from "../services/athlete-service";

export function useCreateAthleteInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAthleteInvite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["athletes", "pending-invites"] });
    },
  });
}
