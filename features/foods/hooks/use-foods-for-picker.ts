"use client";

import { useQuery } from "@tanstack/react-query";

import { listFoodsForPicker } from "../services/food-service";

export function useFoodsForPicker() {
  return useQuery({
    queryKey: ["foods", "picker"],
    queryFn: listFoodsForPicker,
  });
}
