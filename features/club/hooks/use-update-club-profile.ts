"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateClubProfile } from "../services/club-service";
import type { ClubProfileInput } from "../types/club-types";

export function useUpdateClubProfile(clubId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ClubProfileInput) => updateClubProfile(clubId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["club"] });
      // The dashboard greets the owner with the club name.
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
