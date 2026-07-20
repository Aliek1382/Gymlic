"use client";

import { useMutation } from "@tanstack/react-query";

import { createClub } from "../services/auth-service";

export function useCreateClub() {
  return useMutation({
    mutationFn: (name: string) => createClub(name),
  });
}
