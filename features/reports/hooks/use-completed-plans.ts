"use client";

import { useQuery } from "@tanstack/react-query";

import { listCompletedPlansForAthlete } from "../services/report-service";

export function useCompletedPlans(athleteId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["reports", "completed-plans", athleteId],
    queryFn: () => listCompletedPlansForAthlete(athleteId),
    enabled,
  });
}
