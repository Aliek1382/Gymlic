"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { markConversationRead } from "../services/message-service";
import { messageThreadsQueryKey } from "./use-message-threads";

export function useMarkConversationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (counterpartId: string) => markConversationRead(counterpartId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageThreadsQueryKey() });
      // The bell reads the same notification rows this just cleared.
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
