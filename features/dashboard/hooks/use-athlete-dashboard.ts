"use client";

import { useQuery } from "@tanstack/react-query";

import { getAthleteDashboard } from "../services/athlete-dashboard-service";

export function useAthleteDashboard() {
  return useQuery({
    queryKey: ["dashboard", "athlete-dashboard"],
    queryFn: getAthleteDashboard,
  });
}
