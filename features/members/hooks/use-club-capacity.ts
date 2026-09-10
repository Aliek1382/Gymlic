"use client";

import { useQuery } from "@tanstack/react-query";

import { getClubCapacity } from "../services/member-service";

export function useClubCapacity(clubId: string) {
  return useQuery({
    queryKey: ["club-members", "capacity", clubId],
    queryFn: () => getClubCapacity(clubId),
  });
}
