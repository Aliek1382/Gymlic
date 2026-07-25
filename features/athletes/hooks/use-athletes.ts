"use client";

import { useQuery } from "@tanstack/react-query";

import { listAthletes } from "../services/athlete-service";

export function useAthletes() {
  return useQuery({
    queryKey: ["athletes", "list"],
    queryFn: listAthletes,
  });
}
