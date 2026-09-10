"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { addPlanComment } from "@/features/athletes/services/plan-comment-service";
import type { PlanKind } from "@/features/athletes/types/athlete-types";
import { conversationQueryKey } from "./use-conversation";
import { messageThreadsQueryKey } from "./use-message-threads";

// A message from the inbox is the same plan_comments row the per-plan
// thread writes — the notification to the other side is fired by the
// database trigger either way.
export function useSendMessage(counterpartId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      kind,
      assignmentId,
      body,
    }: {
      kind: PlanKind;
      assignmentId: string;
      body: string;
    }) => addPlanComment(kind, assignmentId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationQueryKey(counterpartId) });
      queryClient.invalidateQueries({ queryKey: messageThreadsQueryKey() });
    },
  });
}
