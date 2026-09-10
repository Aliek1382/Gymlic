"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteMembershipPlan } from "../services/club-service";

export function useDeleteMembershipPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMembershipPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club"] });
      queryClient.invalidateQueries({ queryKey: ["club-members"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
