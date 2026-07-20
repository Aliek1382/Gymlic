"use client";

import { useMutation } from "@tanstack/react-query";

import { chooseRole } from "../services/auth-service";
import type { AccountType } from "@/types/database.types";

export function useChooseRole() {
  return useMutation({
    mutationFn: (role: AccountType) => chooseRole(role),
  });
}
