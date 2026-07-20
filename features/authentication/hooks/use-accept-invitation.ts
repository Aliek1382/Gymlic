"use client";

import { useMutation } from "@tanstack/react-query";

import { acceptInvitation } from "../services/auth-service";

export function useAcceptInvitation() {
  return useMutation({
    mutationFn: (code: string) => acceptInvitation(code),
  });
}
