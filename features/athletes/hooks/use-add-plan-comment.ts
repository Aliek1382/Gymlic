"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { addPlanComment } from "../services/plan-comment-service";
import { planCommentsQueryKey } from "./use-plan-comments";
import type { PlanKind } from "../types/athlete-types";

export function useAddPlanComment(kind: PlanKind, assignmentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: string) => addPlanComment(kind, assignmentId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: planCommentsQueryKey(kind, assignmentId),
      });
    },
  });
}
