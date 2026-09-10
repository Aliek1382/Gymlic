"use client";

import { useQuery } from "@tanstack/react-query";

import { getAthleteProfile } from "../services/athlete-service";

export function useAthleteProfile(athleteId: string) {
  return useQuery({
    queryKey: ["athletes", "profile", athleteId],
    queryFn: () => getAthleteProfile(athleteId),
  });
}
