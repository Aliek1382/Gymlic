"use client";

import { useQuery } from "@tanstack/react-query";

import { listTechniques } from "../services/technique-service";

export function useTechniques(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["techniques", "list"],
    queryFn: listTechniques,
    enabled: options?.enabled ?? true,
  });
}
