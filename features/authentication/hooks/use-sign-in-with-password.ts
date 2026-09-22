"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { signInWithPassword } from "../services/auth-service";

export function useSignInWithPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      signInWithPassword(email, password),
    // Everything cached belongs to whoever was (or wasn't) signed in a moment
    // ago — including the null session the login page's own gate just cached,
    // which would otherwise bounce the new session straight back here.
    onSuccess: () => queryClient.clear(),
  });
}
