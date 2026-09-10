"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { PlanKind } from "@/features/athletes/types/athlete-types";
import { sendMessage } from "../services/message-service";
import { conversationQueryKey } from "./use-conversation";
import { messageThreadsQueryKey } from "./use-message-threads";

// `plan` is optional: a message with no plan on it is an ordinary direct
// message, which is what lets a conversation start before the first plan
// exists. The notification to the other side is fired by the database
// trigger either way.
export function useSendMessage(counterpartId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      body,
      plan,
    }: {
      body: string;
      plan?: { kind: PlanKind; id: string } | null;
    }) => sendMessage(counterpartId as string, body, plan),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationQueryKey(counterpartId) });
      queryClient.invalidateQueries({ queryKey: messageThreadsQueryKey() });
      // The per-plan thread renders the same rows.
      queryClient.invalidateQueries({ queryKey: ["athletes", "plan-comments"] });
    },
  });
}
