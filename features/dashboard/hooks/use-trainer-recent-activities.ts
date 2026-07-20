"use client";

import { useQuery } from "@tanstack/react-query";

import { getTrainerRecentActivities } from "../services/trainer-dashboard-service";
import { MAX_RECENT_ACTIVITIES } from "../constants/dashboard";

export function useTrainerRecentActivities() {
  return useQuery({
    queryKey: ["dashboard", "trainer-recent-activities"],
    queryFn: () => getTrainerRecentActivities(MAX_RECENT_ACTIVITIES),
  });
}
