"use client";

import { useMutation } from "@tanstack/react-query";

import { verifyOtp } from "../services/auth-service";

export function useVerifyOtp() {
  return useMutation({
    mutationFn: ({ phone, code }: { phone: string; code: string }) =>
      verifyOtp(phone, code),
  });
}
