"use client";

import { useQuery } from "@tanstack/react-query";

import { getTrainerDraftPlans } from "../services/trainer-dashboard-service";

const MAX_DRAFT_PLANS = 5;

export function useTrainerDraftPlans() {
  return useQuery({
    queryKey: ["dashboard", "trainer-draft-plans"],
    queryFn: () => getTrainerDraftPlans(MAX_DRAFT_PLANS),
  });
}
