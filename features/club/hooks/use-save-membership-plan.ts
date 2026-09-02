"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createMembershipPlan,
  updateMembershipPlan,
} from "../services/club-service";
import type { MembershipPlanInput } from "../types/club-types";

export function useSaveMembershipPlan(clubId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      planId,
      input,
    }: {
      planId?: string;
      input: MembershipPlanInput;
    }) =>
      planId
        ? updateMembershipPlan(planId, input)
        : createMembershipPlan(clubId, input).then(() => undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club"] });
      // Member rows and the dashboard's distribution chart name the plan.
      queryClient.invalidateQueries({ queryKey: ["club-members"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
