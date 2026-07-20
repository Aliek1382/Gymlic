"use client";

import { useQuery } from "@tanstack/react-query";

import { getSubscription } from "../services/dashboard-service";

export function useSubscription(clubId: string | null) {
  return useQuery({
    queryKey: ["dashboard", "subscription", clubId],
    queryFn: () => getSubscription(clubId as string),
    enabled: !!clubId,
  });
}
