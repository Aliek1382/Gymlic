"use client";

import { useQuery } from "@tanstack/react-query";

import { listMyPlans } from "../services/athlete-service";
import type { PlanKind } from "../types/athlete-types";

export function useMyPlans(kind: PlanKind) {
  return useQuery({
    queryKey: ["athletes", "my-plans", kind],
    queryFn: () => listMyPlans(kind),
  });
}
