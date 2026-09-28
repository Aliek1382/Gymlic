"use client";

import { useQuery } from "@tanstack/react-query";

import { listInvoices } from "../services/invoice-service";

/** Trainer side. Omit the athlete to get every invoice on the roster. */
export function useInvoices(athleteId?: string, enabled = true) {
  return useQuery({
    queryKey: ["invoices", "trainer", athleteId ?? "all"],
    queryFn: () => listInvoices(athleteId),
    enabled,
  });
}
