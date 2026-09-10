"use client";

import { useEffect, useId } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import { getConversation } from "../services/message-service";

export function conversationQueryKey(counterpartId: string | null) {
  return ["messages", "conversation", counterpartId];
}

export function useConversation(counterpartId: string | null) {
  const queryClient = useQueryClient();
  // Unique per subscriber — see the note in useMessageThreads.
  const channelId = useId();

  const query = useQuery({
    queryKey: conversationQueryKey(counterpartId),
    queryFn: () => getConversation(counterpartId as string),
    enabled: !!counterpartId,
  });

  useEffect(() => {
    if (!counterpartId) return;

    const supabase = createClient();
    // Postgres changes filters take one column, and a conversation is
    // "either direction between these two" — so this listens to the user's
    // visible messages and lets getConversation decide what belongs here.
    const channel = supabase
      .channel(`conversation:${counterpartId}:${channelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          queryClient.invalidateQueries({ queryKey: conversationQueryKey(counterpartId) });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, counterpartId, queryClient]);

  return query;
}
