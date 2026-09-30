"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { applyTemplate } from "../services/athlete-service";
import type { PlanKind, PlanTarget } from "../types/athlete-types";

function targetKey(target: PlanTarget) {
  return "athleteId" in target ? target.athleteId : target.invitationId;
}

export function useApplyTemplate(kind: PlanKind, target: PlanTarget) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (templateId: string) => applyTemplate(kind, templateId, target),
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
