"use client";

import { useQuery } from "@tanstack/react-query";

import { getAthleteDashboard } from "../services/athlete-dashboard-service";

export function useAthleteDashboard(athleteId: string) {
  return useQuery({
    queryKey: ["dashboard", "athlete-dashboard", athleteId],
    queryFn: () => getAthleteDashboard(athleteId),
  });
}
