"use client";

import { useQuery } from "@tanstack/react-query";

import { getClubRevenueSummary } from "../services/revenue-service";

export function useClubRevenueSummary(clubId: string) {
  return useQuery({
    queryKey: ["club-revenue", "summary", clubId],
    queryFn: () => getClubRevenueSummary(clubId),
  });
}
