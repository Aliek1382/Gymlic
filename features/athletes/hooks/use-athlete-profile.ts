"use client";

import { useQuery } from "@tanstack/react-query";

import { getAthleteProfile } from "../services/athlete-service";

/** Pass null to skip the request (a plan pre-assigned to a pending invite has no athlete yet). */
export function useAthleteProfile(athleteId: string | null) {
  return useQuery({
    queryKey: ["athletes", "profile", athleteId],
    queryFn: () => getAthleteProfile(athleteId as string),
    enabled: athleteId !== null,
  });
}
