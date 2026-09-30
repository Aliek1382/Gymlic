"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createSupplementPlan,
  deleteSupplementPlan,
  updateSupplementPlan,
} from "../services/supplement-service";

/** The trainer's and the athlete's lists both move with a plan. */
function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["supplement-plans"] });
  };
}

export function useCreateSupplementPlan() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: createSupplementPlan, onSuccess: invalidate });
}

export function useUpdateSupplementPlan() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: updateSupplementPlan, onSuccess: invalidate });
}

export function useDeleteSupplementPlan() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: deleteSupplementPlan, onSuccess: invalidate });
}
