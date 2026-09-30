"use client";

import { useQuery } from "@tanstack/react-query";

import { getTrainerEarningsSeries } from "../services/earnings-service";

export function useTrainerEarningsSeries(months: number, enabled = true) {
  return useQuery({
    queryKey: ["earnings", "series", months],
    queryFn: () => getTrainerEarningsSeries(months),
    enabled,
  });
}
