"use client";

import { useQuery } from "@tanstack/react-query";

import { listSessionPackages } from "../services/session-package-service";

/** Trainer side: one athlete's packages. */
export function useSessionPackages(athleteId: string) {
  return useQuery({
    queryKey: ["session-packages", "trainer", athleteId],
    queryFn: () => listSessionPackages(athleteId),
    enabled: Boolean(athleteId),
  });
}
