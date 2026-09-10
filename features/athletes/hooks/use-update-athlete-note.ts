"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateAthleteNote } from "../services/athlete-service";

export function useUpdateAthleteNote(athleteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (note: string | null) => updateAthleteNote(athleteId, note),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["athletes", "profile", athleteId],
      });
    },
  });
}
