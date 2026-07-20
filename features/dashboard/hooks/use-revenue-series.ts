"use client";

import { useQuery } from "@tanstack/react-query";

import { getRevenueSeries } from "../services/dashboard-service";

export function useRevenueSeries(clubId: string | null, months: number) {
  return useQuery({
    queryKey: ["dashboard", "revenue-series", clubId, months],
    queryFn: () => getRevenueSeries(clubId as string, months),
    enabled: !!clubId,
  });
}
