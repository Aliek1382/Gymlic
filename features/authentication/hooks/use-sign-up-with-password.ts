"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { signUpWithPassword } from "../services/auth-service";

export function useSignUpWithPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      name,
      email,
      password,
    }: {
      name: string;
      email: string;
      password: string;
    }) => signUpWithPassword(name, email, password),
    // See useSignInWithPassword: the login page cached a null session before
    // this account existed.
    onSuccess: () => queryClient.clear(),
  });
}
