"use client";

import { useQuery } from "@tanstack/react-query";

import { listClubTrainers } from "../services/trainer-service";

export function useClubTrainerList(clubId: string) {
  return useQuery({
    queryKey: ["club-trainers", "list", clubId],
    queryFn: () => listClubTrainers(clubId),
  });
}
