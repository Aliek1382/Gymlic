"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateMembership } from "../services/member-service";

export function useUpdateMembership() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMembership,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club-members"] });
      // The club dashboard's member count, plan distribution and capacity
      // bar all read the same rows.
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
