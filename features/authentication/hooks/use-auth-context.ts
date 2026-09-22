"use client";

import { useQuery } from "@tanstack/react-query";

import {
  getAdminContext,
  getAuthContext,
  getInvitationPreview,
} from "../services/auth-context-service";

/**
 * The session gate for every protected layout. Kept fresh for a minute so
 * navigating between panel pages does not re-run the three profile queries
 * on each route change.
 */
export function useAuthContext() {
  return useQuery({
    queryKey: ["auth", "context"],
    queryFn: getAuthContext,
    staleTime: 60_000,
    retry: false,
  });
}

export function useAdminContext() {
  return useQuery({
    queryKey: ["auth", "admin-context"],
    queryFn: getAdminContext,
    staleTime: 60_000,
    retry: false,
  });
}

export function useInvitationPreview(code: string) {
  return useQuery({
    queryKey: ["auth", "invitation-preview", code],
    queryFn: () => getInvitationPreview(code),
    enabled: code.length > 0,
    retry: false,
  });
}
