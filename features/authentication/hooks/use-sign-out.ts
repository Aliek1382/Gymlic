"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { signOut } from "../services/auth-service";

export function useSignOut() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      // Drop the signed-out user's data rather than leaving it for whoever
      // signs in next on this browser.
      queryClient.clear();
      router.replace("/login");
      router.refresh();
    },
  });
}
