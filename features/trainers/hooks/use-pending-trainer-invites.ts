"use client";

import { useQuery } from "@tanstack/react-query";

import { listPendingTrainerInvites } from "../services/trainer-service";

export function usePendingTrainerInvites(clubId: string) {
  return useQuery({
    queryKey: ["club-trainers", "pending-invites", clubId],
    queryFn: () => listPendingTrainerInvites(clubId),
  });
}
