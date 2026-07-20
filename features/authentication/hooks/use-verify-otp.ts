"use client";

import { useMutation } from "@tanstack/react-query";

import { verifyOtp, type OtpMethod } from "../services/auth-service";

export function useVerifyOtp() {
  return useMutation({
    mutationFn: ({
      method,
      value,
      code,
    }: {
      method: OtpMethod;
      value: string;
      code: string;
    }) => verifyOtp(method, value, code),
  });
}
