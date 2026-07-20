"use client";

import { useQuery } from "@tanstack/react-query";

import { getActiveClubId, getClubName } from "../services/dashboard-service";

/**
 * Loads the core shell data every Dashboard needs first: which club the
 * current user is scoped to, and its display name (Dashboard Pack #20 —
 * Loading Order: Session -> User -> Membership -> Club -> ...).
 */
export function useDashboard() {
  const clubIdQuery = useQuery({
    queryKey: ["dashboard", "active-club"],
    queryFn: getActiveClubId,
  });

  const clubId = clubIdQuery.data ?? null;

  const clubNameQuery = useQuery({
    queryKey: ["dashboard", "club-name", clubId],
    queryFn: () => getClubName(clubId as string),
    enabled: !!clubId,
  });

  return {
    clubId,
    clubName: clubNameQuery.data ?? null,
    isLoading: clubIdQuery.isLoading || (!!clubId && clubNameQuery.isLoading),
    isError: clubIdQuery.isError || clubNameQuery.isError,
  };
}
