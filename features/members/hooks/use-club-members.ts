"use client";

import { useQuery } from "@tanstack/react-query";

import { listClubMembers } from "../services/member-service";

export function useClubMembers(clubId: string) {
  return useQuery({
    queryKey: ["club-members", "list", clubId],
    queryFn: () => listClubMembers(clubId),
  });
}
