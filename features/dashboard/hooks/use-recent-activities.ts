"use client";

import { useClubDashboardSlice } from "./use-club-dashboard";

export function useRecentActivities(clubId: string | null) {
  return useClubDashboardSlice(clubId, (data) => data.recentActivities);
}
