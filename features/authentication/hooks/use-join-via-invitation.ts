"use client";

import { useMutation } from "@tanstack/react-query";

import { joinViaInvitation } from "../services/auth-service";

export function useJoinViaInvitation() {
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
  });
}
