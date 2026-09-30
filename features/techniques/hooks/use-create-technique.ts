"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createTechnique } from "../services/technique-service";

export function useCreateTechnique() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTechnique,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["techniques", "list"] });
    },
  });
}
