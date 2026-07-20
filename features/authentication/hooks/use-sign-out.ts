"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";

import { signOut } from "../services/auth-service";

export function useSignOut() {
  const router = useRouter();

  return useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      router.replace("/login");
      router.refresh();
    },
  });
}
