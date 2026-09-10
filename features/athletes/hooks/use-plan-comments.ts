"use client";

import { useEffect, useId } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import { listPlanComments } from "../services/plan-comment-service";
import type { PlanKind } from "../types/athlete-types";

export function planCommentsQueryKey(kind: PlanKind, assignmentId: string) {
  return ["athletes", "plan-comments", kind, assignmentId];
}

// Keeps the thread live with a Realtime subscription, same shape as
// useNotifications — whoever's on the other end sees a reply without a
// refresh. The rows are messages carrying this plan's reference (0036).
export function usePlanComments(kind: PlanKind, assignmentId: string, enabled = true) {
  const queryClient = useQueryClient();
  const queryKey = planCommentsQueryKey(kind, assignmentId);
  // Unique per subscriber: the same plan's thread can be on screen twice
  // (a list row and the plan dialog), and a shared channel instance would be
  // torn down for one by the other's unmount.
  const channelId = useId();

  const query = useQuery({
    queryKey,
    queryFn: () => listPlanComments(kind, assignmentId),
    enabled,
  });

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`plan-comments:${kind}:${assignmentId}:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `plan_id=eq.${assignmentId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, kind, assignmentId, channelId, queryClient, queryKey]);

  return query;
}
