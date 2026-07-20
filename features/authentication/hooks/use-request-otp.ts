"use client";

import { useMutation } from "@tanstack/react-query";

import { requestOtp } from "../services/auth-service";
import type { LoginMethod } from "../validators/auth-schemas";

export function useRequestOtp() {
  return useMutation({
    mutationFn: ({ method, value }: { method: LoginMethod; value: string }) =>
      requestOtp(method, value),
  });
}
