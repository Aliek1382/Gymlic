"use client";

import { useQuery } from "@tanstack/react-query";

import { listTemplates } from "../services/athlete-service";
import type { PlanKind } from "../types/athlete-types";

export function useTemplates(kind: PlanKind, enabled: boolean) {
  return useQuery({
    queryKey: ["athletes", "templates", kind],
    queryFn: () => listTemplates(kind),
    enabled,
  });
}
