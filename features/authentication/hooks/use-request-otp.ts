"use client";

import { useMutation } from "@tanstack/react-query";

import { requestOtp, type OtpMethod } from "../services/auth-service";

export function useRequestOtp() {
  return useMutation({
    mutationFn: ({ method, value }: { method: OtpMethod; value: string }) =>
      requestOtp(method, value),
  });
}
