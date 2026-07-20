"use client";

import { useMutation } from "@tanstack/react-query";

import { requestOtp } from "../services/auth-service";

export function useRequestOtp() {
  return useMutation({
    mutationFn: (phone: string) => requestOtp(phone),
  });
}
