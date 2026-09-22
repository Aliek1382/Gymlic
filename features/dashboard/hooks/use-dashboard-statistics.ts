"use client";

import { useClubDashboardSlice } from "./use-club-dashboard";

export function useDashboardStatistics(clubId: string | null) {
  return useClubDashboardSlice(clubId, (data) => data.statistics);
}
