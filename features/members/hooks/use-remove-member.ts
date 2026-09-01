"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { removeMember } from "../services/member-service";

export function useRemoveMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club-members"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
