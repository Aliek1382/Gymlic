"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createPlan } from "../services/athlete-service";
import type { PlanKind } from "../types/athlete-types";

export function useCreatePlan(kind: PlanKind, athleteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      title,
      description,
    }: {
      title: string;
      description: string | null;
    }) => createPlan(kind, athleteId, title, description),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["athletes", "plans", kind, athleteId],
      });
    },
  });
}
