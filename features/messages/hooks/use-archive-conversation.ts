"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { archiveConversation, unarchiveConversation } from "../services/message-service";
import { messageThreadsQueryKey } from "./use-message-threads";

/** Moves one conversation into or out of the viewer's archive. */
export function useArchiveConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ counterpartId, archived }: { counterpartId: string; archived: boolean }) =>
      archived ? archiveConversation(counterpartId) : unarchiveConversation(counterpartId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageThreadsQueryKey() });
    },
  });
}
