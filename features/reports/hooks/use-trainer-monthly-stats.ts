"use client";

import { useQuery } from "@tanstack/react-query";

import { getTrainerMonthlyStats } from "../services/report-service";

export function useTrainerMonthlyStats() {
  return useQuery({
    queryKey: ["reports", "trainer-monthly-stats"],
    queryFn: getTrainerMonthlyStats,
  });
}
