"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateProfileInfo } from "../services/settings-service";

export function useUpdateProfileInfo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProfileInfo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "profile"] });
    },
  });
}
