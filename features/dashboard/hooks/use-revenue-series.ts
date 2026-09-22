"use client";

import { useClubDashboardSlice } from "./use-club-dashboard";

export function useRevenueSeries(clubId: string | null, months: number) {
  return useClubDashboardSlice(clubId, (data) => data.revenueSeries, months);
}
