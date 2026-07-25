"use client";

import { useQuery } from "@tanstack/react-query";

import { listPendingAthleteInvites } from "../services/athlete-service";

export function usePendingAthleteInvites() {
  return useQuery({
    queryKey: ["athletes", "pending-invites"],
    queryFn: listPendingAthleteInvites,
  });
}
