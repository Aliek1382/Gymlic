"use client";

import { useMutation } from "@tanstack/react-query";

import type { InvitationRole } from "@/types/database.types";
import { acceptInvitationForCurrentUser } from "../services/auth-service";

export function useAcceptInvitationForCurrentUser() {
  return useMutation({
    mutationFn: ({
      code,
      invitedRole,
    }: {
      code: string;
      invitedRole: InvitationRole;
    }) => acceptInvitationForCurrentUser(code, invitedRole),
  });
}
