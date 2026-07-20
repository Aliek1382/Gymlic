"use client";

import { useQuery } from "@tanstack/react-query";

import { getClubStatistics } from "../services/dashboard-service";

export function useDashboardStatistics(clubId: string | null) {
  return useQuery({
    queryKey: ["dashboard", "statistics", clubId],
    queryFn: () => getClubStatistics(clubId as string),
    enabled: !!clubId,
  });
}
