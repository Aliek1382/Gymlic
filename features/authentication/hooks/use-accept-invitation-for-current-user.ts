"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { InvitationRole } from "@/types/database.types";
import { acceptInvitationForCurrentUser } from "../services/auth-service";

export function useAcceptInvitationForCurrentUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      code,
      invitedRole,
    }: {
      code: string;
      invitedRole: InvitationRole;
    }) => acceptInvitationForCurrentUser(code, invitedRole),
    // Accepting sets the role, the club membership and the trainer link in
    // one go — all of it session context the route gates read.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auth"] }),
  });
}
