"use client";

import { useQuery } from "@tanstack/react-query";

import { listMyInvoices } from "../services/invoice-service";

export function useMyInvoices() {
  return useQuery({
    queryKey: ["invoices", "mine"],
    queryFn: listMyInvoices,
  });
}
