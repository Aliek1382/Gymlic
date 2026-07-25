"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createPlan } from "../services/athlete-service";
import type { PlanKind, PlanTarget } from "../types/athlete-types";

function targetKey(target: PlanTarget) {
  return "athleteId" in target ? target.athleteId : target.invitationId;
}

export function useCreatePlan(kind: PlanKind, target: PlanTarget) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      title,
      description,
    }: {
      title: string;
      description: string | null;
    }) => createPlan(kind, target, title, description),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["athletes", "plans", kind, targetKey(target)],
      });
    },
  });
}
