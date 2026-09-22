"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { getTrainerDashboard } from "../services/trainer-dashboard-service";

type TrainerDashboard = Awaited<ReturnType<typeof getTrainerDashboard>>;

export function trainerDashboardQueryKey() {
  return ["dashboard", "trainer"];
}

/**
 * Counts, activity and drafts come back in one request, so each card reads a
 * slice of this one query instead of issuing its own.
 */
export function useTrainerDashboardSlice<T>(
  select: (data: TrainerDashboard) => T
): UseQueryResult<T> {
  return useQuery({
    queryKey: trainerDashboardQueryKey(),
    queryFn: getTrainerDashboard,
    select,
  });
}
