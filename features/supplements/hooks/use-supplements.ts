"use client";

import { useQuery } from "@tanstack/react-query";

import { listSupplements } from "../services/supplement-service";

export function useSupplements() {
  return useQuery({
    queryKey: ["supplements", "list"],
    queryFn: listSupplements,
  });
}
