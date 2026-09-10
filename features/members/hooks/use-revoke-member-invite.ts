"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { revokeMemberInvite } from "../services/member-service";

export function useRevokeMemberInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: revokeMemberInvite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club-members"] });
    },
  });
}
