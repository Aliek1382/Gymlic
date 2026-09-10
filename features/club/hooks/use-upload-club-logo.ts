"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { uploadClubLogo } from "../services/club-service";

export function useUploadClubLogo(clubId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => uploadClubLogo(clubId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club"] });
    },
  });
}
