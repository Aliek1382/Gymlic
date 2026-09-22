"use client";

import { useClubDashboardSlice } from "./use-club-dashboard";

export function useMemberDistribution(clubId: string | null) {
  return useClubDashboardSlice(clubId, (data) => data.memberDistribution);
}
