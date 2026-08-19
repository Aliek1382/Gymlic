"use client";

import { useQuery } from "@tanstack/react-query";

import { getTrainerCompletionRates } from "../services/report-service";

export function useTrainerCompletionRates() {
  return useQuery({
    queryKey: ["reports", "trainer-completion-rates"],
    queryFn: getTrainerCompletionRates,
  });
}
