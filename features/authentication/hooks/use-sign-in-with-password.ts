"use client";

import { useMutation } from "@tanstack/react-query";

import { signInWithPassword } from "../services/auth-service";

export function useSignInWithPassword() {
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      signInWithPassword(email, password),
  });
}
