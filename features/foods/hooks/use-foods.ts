"use client";

import { useQuery } from "@tanstack/react-query";

import { listFoods } from "../services/food-service";

export function useFoods(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["foods", "list"],
    queryFn: listFoods,
    enabled: options?.enabled ?? true,
  });
}
