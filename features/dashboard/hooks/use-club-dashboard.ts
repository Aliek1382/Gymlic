"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getClubDashboard } from "../services/dashboard-service";
import { DEFAULT_REVENUE_MONTHS } from "../constants/dashboard";
import type { ClubDashboardData } from "../types/dashboard-types";

export function clubDashboardQueryKey(clubId: string | null, months: number) {
  return ["dashboard", "club", clubId, months];
}

/**
 * The whole club dashboard comes back in one request now, so every card
 * reads from this one query instead of issuing its own.
 */
export function useClubDashboard(clubId: string | null, months = DEFAULT_REVENUE_MONTHS) {
  return useQuery({
    queryKey: clubDashboardQueryKey(clubId, months),
    queryFn: () => getClubDashboard(clubId as string, months),
    enabled: !!clubId,
  });
}

/** Narrows the shared query to one card's slice, keeping its loading state. */
export function useClubDashboardSlice<T>(
  clubId: string | null,
  select: (data: ClubDashboardData) => T,
  months = DEFAULT_REVENUE_MONTHS
): UseQueryResult<T> {
  return useQuery({
    queryKey: clubDashboardQueryKey(clubId, months),
    queryFn: () => getClubDashboard(clubId as string, months),
    enabled: !!clubId,
    select,
  });
}
