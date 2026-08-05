"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateEmail } from "../services/settings-service";

export function useUpdateEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateEmail,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "profile"] });
    },
  });
}
