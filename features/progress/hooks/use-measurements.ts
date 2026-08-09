"use client";

import { useQuery } from "@tanstack/react-query";

import { listMeasurements } from "../services/progress-service";

export function useMeasurements(athleteId: string | undefined) {
  return useQuery({
    queryKey: ["progress", "measurements", athleteId],
    queryFn: () => listMeasurements(athleteId!),
    enabled: !!athleteId,
  });
}
