"use client";

import { useQuery } from "@tanstack/react-query";

import { listPlans } from "../services/athlete-service";
import type { PlanKind } from "../types/athlete-types";

export function usePlans(kind: PlanKind, athleteId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["athletes", "plans", kind, athleteId],
    queryFn: () => listPlans(kind, athleteId),
    enabled,
  });
}
