"use client";

import { useQuery } from "@tanstack/react-query";

import { listPendingMemberInvites } from "../services/member-service";

export function usePendingMemberInvites(clubId: string) {
  return useQuery({
    queryKey: ["club-members", "pending-invites", clubId],
    queryFn: () => listPendingMemberInvites(clubId),
  });
}
