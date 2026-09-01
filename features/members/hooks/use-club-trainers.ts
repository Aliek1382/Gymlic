"use client";

import { useQuery } from "@tanstack/react-query";

import { listClubTrainers } from "../services/member-service";

export function useClubTrainers(clubId: string) {
  return useQuery({
    queryKey: ["club-members", "trainers", clubId],
    queryFn: () => listClubTrainers(clubId),
  });
}
