"use client";

import { useQuery } from "@tanstack/react-query";

import { listAthleteProgress } from "../services/report-service";

export function useAthleteProgress() {
  return useQuery({
    queryKey: ["reports", "athlete-progress"],
    queryFn: listAthleteProgress,
  });
}
