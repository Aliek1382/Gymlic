"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateTrainerStatus } from "../services/trainer-service";

export function useUpdateTrainerStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTrainerStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club-trainers"] });
      // The club dashboard's "مربیان فعال" card counts the same rows.
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
