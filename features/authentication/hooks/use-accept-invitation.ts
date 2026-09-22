"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { acceptInvitation } from "../services/auth-service";

export function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (code: string) => acceptInvitation(code),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth"] }),
  });
}
