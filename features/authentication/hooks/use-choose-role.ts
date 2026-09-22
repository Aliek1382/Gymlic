"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { chooseRole } from "../services/auth-service";
import type { AccountType } from "@/types/database.types";

export function useChooseRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (role: AccountType) => chooseRole(role),
    // The role is part of the session context every route gate reads.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth"] }),
  });
}
