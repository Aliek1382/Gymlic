"use client";

import { useQuery } from "@tanstack/react-query";

import { listSupplementsForPicker } from "../services/supplement-service";

export function useSupplementsForPicker() {
  return useQuery({
    queryKey: ["supplements", "picker"],
    queryFn: listSupplementsForPicker,
  });
}
