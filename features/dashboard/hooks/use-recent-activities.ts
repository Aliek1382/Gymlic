"use client";

import { useQuery } from "@tanstack/react-query";

import { getRecentActivities } from "../services/dashboard-service";
import { MAX_RECENT_ACTIVITIES } from "../constants/dashboard";

export function useRecentActivities(clubId: string | null) {
  return useQuery({
    queryKey: ["dashboard", "recent-activities", clubId],
    queryFn: () => getRecentActivities(clubId as string, MAX_RECENT_ACTIVITIES),
    enabled: !!clubId,
  });
}
