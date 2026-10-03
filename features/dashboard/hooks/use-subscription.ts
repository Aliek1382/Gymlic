"use client";

import { useClubDashboardSlice } from "./use-club-dashboard";

export function useSubscription(clubId: string | null) {
  return useClubDashboardSlice(clubId, (data) => data.subscription);
}

/** The free club plan, while the club has no paid plan running. */
export function useFreeClubPlan(clubId: string | null) {
  return useClubDashboardSlice(clubId, (data) => data.freePlan ?? null);
}
