"use client";

import { useQuery } from "@tanstack/react-query";

import { listSupplementPlans } from "../services/supplement-service";

export function useSupplementPlans(athleteId: string) {
  return useQuery({
    queryKey: ["supplement-plans", "athlete", athleteId],
    queryFn: () => listSupplementPlans(athleteId),
  });
}
