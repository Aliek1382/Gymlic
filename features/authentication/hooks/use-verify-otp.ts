"use client";

import { useMutation } from "@tanstack/react-query";

import { verifyOtp } from "../services/auth-service";
import type { LoginMethod } from "../validators/auth-schemas";

export function useVerifyOtp() {
  return useMutation({
    mutationFn: ({
      method,
      value,
      code,
    }: {
      method: LoginMethod;
      value: string;
      code: string;
    }) => verifyOtp(method, value, code),
  });
}
