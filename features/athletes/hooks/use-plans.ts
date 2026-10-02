"use client";

import { useQuery } from "@tanstack/react-query";

import { listPlans } from "../services/athlete-service";
import type { PlanKind, PlanTarget } from "../types/athlete-types";

function targetKey(target: PlanTarget) {
  return "athleteId" in target ? target.athleteId : target.invitationId;
}

export function usePlans(kind: PlanKind, target: PlanTarget, enabled: boolean) {
  return useQuery({
    queryKey: ["athletes", "plans", kind, targetKey(target)],
    queryFn: () => listPlans(kind, target),
    select: (data) => data.items,
    enabled,
  });
}

/** The same request's "N plans hidden by the history limit" (no second fetch). */
export function useHiddenPlans(kind: PlanKind, target: PlanTarget, enabled: boolean) {
  return useQuery({
    queryKey: ["athletes", "plans", kind, targetKey(target)],
    queryFn: () => listPlans(kind, target),
    select: (data) => data.hidden,
    enabled,
  });
}
