"use client";

import { useQuery } from "@tanstack/react-query";

import { listMySupplementPlans } from "../services/supplement-service";

export function useMySupplementPlans() {
  return useQuery({
    queryKey: ["supplement-plans", "mine"],
    queryFn: listMySupplementPlans,
  });
}
