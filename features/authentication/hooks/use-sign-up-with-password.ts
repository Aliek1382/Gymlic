"use client";

import { useMutation } from "@tanstack/react-query";

import { signUpWithPassword } from "../services/auth-service";

export function useSignUpWithPassword() {
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
  });
}
