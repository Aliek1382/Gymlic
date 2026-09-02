"use client";

import { useQuery } from "@tanstack/react-query";

import { getMemberProfile } from "../services/member-service";

export function useMemberProfile(clubId: string, membershipId: string) {
  return useQuery({
    queryKey: ["club-members", "profile", clubId, membershipId],
    queryFn: () => getMemberProfile(clubId, membershipId),
  });
}
