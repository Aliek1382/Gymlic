"use client";

import { useQuery } from "@tanstack/react-query";

import { getTrainerStatistics } from "../services/trainer-dashboard-service";

export function useTrainerStatistics() {
  return useQuery({
    queryKey: ["dashboard", "trainer-statistics"],
    queryFn: getTrainerStatistics,
  });
}
