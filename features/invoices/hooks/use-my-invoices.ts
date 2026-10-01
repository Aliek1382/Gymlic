"use client";

import { useQuery } from "@tanstack/react-query";

import { listMyInvoices } from "../services/invoice-service";

/** Athlete side: { invoices, claimsEnabled }. */
export function useMyInvoices(enabled = true) {
  return useQuery({
    queryKey: ["invoices", "mine"],
    queryFn: listMyInvoices,
    enabled,
  });
}
