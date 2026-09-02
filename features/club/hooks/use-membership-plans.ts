"use client";

import { useQuery } from "@tanstack/react-query";

import { listMembershipPlans } from "../services/club-service";

export function useMembershipPlans(
  clubId: string,
  options?: { activeOnly?: boolean }
) {
  const activeOnly = options?.activeOnly ?? false;

  return useQuery({
    queryKey: ["club", "membership-plans", clubId, activeOnly],
    queryFn: () => listMembershipPlans(clubId, { activeOnly }),
  });
}
