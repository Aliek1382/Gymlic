"use client";

import { useQuery } from "@tanstack/react-query";

import { listAthletes } from "../services/athlete-service";

export function useAthletes(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["athletes", "list"],
    queryFn: listAthletes,
    enabled: options?.enabled ?? true,
  });
}
