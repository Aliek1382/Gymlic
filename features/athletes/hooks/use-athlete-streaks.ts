"use client";

import { useQuery } from "@tanstack/react-query";

import { listStreaksForAthletes } from "../services/workout-log-service";

// Keyed by the sorted id list, so the athlete list and any other caller
// asking for the same set of athletes share one cached request.
export function useAthleteStreaks(athleteIds: string[]) {
  const sortedIds = [...athleteIds].sort();

  return useQuery({
    queryKey: ["athletes", "streaks", sortedIds],
    queryFn: () => listStreaksForAthletes(sortedIds),
    enabled: sortedIds.length > 0,
  });
}
