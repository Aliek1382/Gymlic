"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { completePlan } from "../services/athlete-service";
import type { PlanKind, PlanTarget } from "../types/athlete-types";

function targetKey(target: PlanTarget) {
  return "athleteId" in target ? target.athleteId : target.invitationId;
}

// `target` is only needed when a trainer completes it on an athlete's
// behalf, to invalidate that athlete's plan list; an athlete completing
// their own plan has no "target" and just refreshes their own plan list.
export function useCompletePlan(kind: PlanKind, target?: PlanTarget) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planId: string) => completePlan(kind, planId),
    onSuccess: () => {
      if (target) {
        queryClient.invalidateQueries({
          queryKey: ["athletes", "plans", kind, targetKey(target)],
        });
      }
      queryClient.invalidateQueries({ queryKey: ["athletes", "my-plans", kind] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}
