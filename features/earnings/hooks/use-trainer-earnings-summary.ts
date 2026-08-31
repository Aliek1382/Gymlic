"use client";

import { useQuery } from "@tanstack/react-query";

import { getTrainerEarningsSummary } from "../services/earnings-service";

export function useTrainerEarningsSummary() {
  return useQuery({
    queryKey: ["earnings", "summary"],
    queryFn: getTrainerEarningsSummary,
  });
}
