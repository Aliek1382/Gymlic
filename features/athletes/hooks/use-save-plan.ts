"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { savePlan } from "../services/athlete-service";
import type { PlanKind, PlanTarget } from "../types/athlete-types";

function targetKey(target: PlanTarget) {
  return "athleteId" in target ? target.athleteId : target.invitationId;
}

export function useSavePlan(kind: PlanKind, target: PlanTarget) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      id?: string;
      title: string;
      description: string | null;
      status: "active" | "draft";
    }) => savePlan(kind, target, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["athletes", "plans", kind, targetKey(target)],
      });
      queryClient.invalidateQueries({
        queryKey: ["dashboard", "trainer-draft-plans"],
      });
    },
  });
}
