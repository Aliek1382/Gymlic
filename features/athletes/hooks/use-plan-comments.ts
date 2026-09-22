"use client";

import { useQuery } from "@tanstack/react-query";

import { CONVERSATION_POLL_MS } from "@/lib/api/polling";
import { listPlanComments } from "../services/plan-comment-service";
import type { PlanKind } from "../types/athlete-types";

export function planCommentsQueryKey(kind: PlanKind, assignmentId: string) {
  return ["athletes", "plan-comments", kind, assignmentId];
}

/**
 * The message thread attached to one plan, polled like an open conversation
 * so whoever's on the other end sees a reply without a refresh.
 */
export function usePlanComments(kind: PlanKind, assignmentId: string, enabled = true) {
  return useQuery({
    queryKey: planCommentsQueryKey(kind, assignmentId),
    queryFn: () => listPlanComments(kind, assignmentId),
    enabled,
    refetchInterval: CONVERSATION_POLL_MS,
  });
}
