"use client";

import { useTrainerDashboardSlice } from "./use-trainer-dashboard";

export function useTrainerRecentActivities() {
  return useTrainerDashboardSlice((data) => data.activity);
}
