"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { uploadAvatar } from "../services/settings-service";

export function useUploadAvatar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadAvatar,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "profile"] });
    },
  });
}
