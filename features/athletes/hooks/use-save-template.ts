"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { saveTemplate } from "../services/athlete-service";
import type { PlanKind } from "../types/athlete-types";

export function useSaveTemplate(kind: PlanKind) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { title: string; description: string | null; sourceId?: string }) =>
      saveTemplate(kind, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["athletes", "templates", kind] });
    },
  });
}
