"use client";

import { useQuery } from "@tanstack/react-query";

import { getTrainerPaymentInfo } from "../services/invoice-service";

/** The trainer's own receiving card (and whether the server can store one). */
export function useTrainerPaymentInfo() {
  return useQuery({
    queryKey: ["invoices", "payment-info"],
    queryFn: getTrainerPaymentInfo,
  });
}
