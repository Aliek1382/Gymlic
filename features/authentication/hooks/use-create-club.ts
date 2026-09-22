"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createClub } from "../services/auth-service";

export function useCreateClub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => createClub(name),
    // The new membership is what the route gates read to decide the owner is
    // past onboarding.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth"] }),
  });
}
