"use client";

import { useQuery } from "@tanstack/react-query";

import { listTrainerPayments } from "../services/earnings-service";

export function useTrainerPayments() {
  return useQuery({
    queryKey: ["earnings", "payments"],
    queryFn: listTrainerPayments,
  });
}
