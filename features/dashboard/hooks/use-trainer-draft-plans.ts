"use client";

import { useTrainerDashboardSlice } from "./use-trainer-dashboard";

export function useTrainerDraftPlans() {
  return useTrainerDashboardSlice((data) => data.drafts);
}
