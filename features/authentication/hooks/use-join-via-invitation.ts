"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { joinViaInvitation } from "../services/auth-service";

export function useJoinViaInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      code,
      email,
      password,
    }: {
      code: string;
      email: string;
      password: string;
    }) => joinViaInvitation(code, email, password),
    // A brand-new session: drop whatever the public join page had cached.
    onSuccess: () => queryClient.clear(),
  });
}
