"use client";

import { useQuery } from "@tanstack/react-query";

import { getClubProfile } from "../services/club-service";

export function useClubProfile(clubId: string) {
  return useQuery({
    queryKey: ["club", "profile", clubId],
    queryFn: () => getClubProfile(clubId),
  });
}
