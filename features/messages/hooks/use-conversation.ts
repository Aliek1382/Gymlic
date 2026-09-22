"use client";

import { useQuery } from "@tanstack/react-query";

import { CONVERSATION_POLL_MS } from "@/lib/api/polling";
import { getConversation } from "../services/message-service";

export function conversationQueryKey(counterpartId: string | null) {
  return ["messages", "conversation", counterpartId];
}

/** An open thread polls faster than the inbox — a reply is awaited here. */
export function useConversation(counterpartId: string | null) {
  return useQuery({
    queryKey: conversationQueryKey(counterpartId),
    queryFn: () => getConversation(counterpartId as string),
    enabled: !!counterpartId,
    refetchInterval: CONVERSATION_POLL_MS,
  });
}
