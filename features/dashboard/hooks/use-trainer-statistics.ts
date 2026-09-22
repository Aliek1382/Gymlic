"use client";

import { useTrainerDashboardSlice } from "./use-trainer-dashboard";

export function useTrainerStatistics() {
  return useTrainerDashboardSlice((data) => data.statistics);
}
