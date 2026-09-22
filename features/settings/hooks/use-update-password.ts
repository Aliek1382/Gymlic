"use client";

import { useMutation } from "@tanstack/react-query";

import { updatePassword } from "../services/settings-service";

export function useUpdatePassword() {
  return useMutation({
    mutationFn: (input: { currentPassword: string; password: string }) =>
      updatePassword(input.currentPassword, input.password),
  });
}
