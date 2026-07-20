"use client";

import { useQuery } from "@tanstack/react-query";

import { getMemberDistribution } from "../services/dashboard-service";

export function useMemberDistribution(clubId: string | null) {
  return useQuery({
    queryKey: ["dashboard", "member-distribution", clubId],
    queryFn: () => getMemberDistribution(clubId as string),
    enabled: !!clubId,
  });
}
