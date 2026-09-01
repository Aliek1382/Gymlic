"use client";

import { useQuery } from "@tanstack/react-query";

import { listRevenueEntries } from "../services/revenue-service";

export function useRevenueEntries(clubId: string) {
  return useQuery({
    queryKey: ["club-revenue", "list", clubId],
    queryFn: () => listRevenueEntries(clubId),
  });
}
