"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { removeAthlete } from "../services/athlete-service";

export function useRemoveAthlete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeAthlete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["athletes", "list"] });
    },
  });
}
