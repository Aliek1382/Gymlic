"use client";

import { useQuery } from "@tanstack/react-query";

import { listPackageSessions } from "../services/session-package-service";

export function usePackageSessions(packageId: string, enabled = true) {
  return useQuery({
    queryKey: ["session-packages", "sessions", packageId],
    queryFn: () => listPackageSessions(packageId),
    enabled,
  });
}
