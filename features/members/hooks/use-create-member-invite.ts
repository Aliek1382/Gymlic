"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createMemberInvite } from "../services/member-service";

export function useCreateMemberInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createMemberInvite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club-members"] });
    },
  });
}
