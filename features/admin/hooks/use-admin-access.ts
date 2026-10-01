"use client";

import { useCallback } from "react";

import { useAdminContext } from "@/features/authentication/hooks/use-auth-context";
import type { AdminPermission } from "@/features/authentication/services/auth-context-service";

export type AdminRequirement = AdminPermission | "super";

/**
 * What the signed-in admin may do, for hiding what they can't. The API checks
 * the same thing on every request (src/AdminAccess.php); this only spares
 * them buttons that would answer "no access".
 */
export function useAdminCan(): (requirement?: AdminRequirement) => boolean {
  const { data } = useAdminContext();
  const access = data?.access;

  return useCallback(
    (requirement?: AdminRequirement) => {
      if (!access) return false;
      if (access.level === "super" || !requirement) return true;
      if (requirement === "super") return false;
      return access.permissions.includes(requirement);
    },
    [access]
  );
}

export function useIsSuperAdmin(): boolean {
  const { data } = useAdminContext();
  return data?.access.level === "super";
}
