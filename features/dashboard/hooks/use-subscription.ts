"use client";

import { useClubDashboardSlice } from "./use-club-dashboard";

export function useSubscription(clubId: string | null) {
  return useClubDashboardSlice(clubId, (data) => data.subscription);
}
