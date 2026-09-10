"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import { getConversation } from "../services/message-service";

export function conversationQueryKey(counterpartId: string | null) {
  return ["messages", "conversation", counterpartId];
}

export function useConversation(counterpartId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: conversationQueryKey(counterpartId),
    queryFn: () => getConversation(counterpartId as string),
    enabled: !!counterpartId,
  });

  useEffect(() => {
    if (!counterpartId) return;

    const supabase = createClient();
    // The thread spans every plan these two share, so it can't be narrowed
    // to one assignment_id the way the per-plan thread in usePlanComments
    // is — any comment this user is allowed to see may belong here, and
    // getConversation decides which ones actually do.
    const channel = supabase
      .channel(`conversation:${counterpartId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "plan_comments" },
        () => {
          queryClient.invalidateQueries({ queryKey: conversationQueryKey(counterpartId) });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [counterpartId, queryClient]);

  return query;
}
