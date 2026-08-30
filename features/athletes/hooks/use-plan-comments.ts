"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import { listPlanComments } from "../services/plan-comment-service";
import type { PlanKind } from "../types/athlete-types";

export function planCommentsQueryKey(kind: PlanKind, assignmentId: string) {
  return ["athletes", "plan-comments", kind, assignmentId];
}

// Keeps the thread live with a Realtime subscription, same shape as
// useNotifications — whoever's on the other end sees a reply without a
// refresh.
export function usePlanComments(kind: PlanKind, assignmentId: string, enabled = true) {
  const queryClient = useQueryClient();
  const queryKey = planCommentsQueryKey(kind, assignmentId);

  const query = useQuery({
    queryKey,
    queryFn: () => listPlanComments(kind, assignmentId),
    enabled,
  });

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`plan-comments:${kind}:${assignmentId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "plan_comments",
          filter: `assignment_id=eq.${assignmentId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, kind, assignmentId, queryClient, queryKey]);

  return query;
}
