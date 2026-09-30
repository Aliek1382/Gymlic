"use client";

import { useQuery } from "@tanstack/react-query";

import { getFinancialSummary } from "../services/earnings-service";

// Keyed under "earnings" so recording, editing or deleting a payment
// invalidates the report along with the rest of the page.
export function useFinancialSummary(from: string, to: string) {
  return useQuery({
    queryKey: ["earnings", "financial-summary", from, to],
    queryFn: () => getFinancialSummary(from, to),
    enabled: from <= to,
  });
}
