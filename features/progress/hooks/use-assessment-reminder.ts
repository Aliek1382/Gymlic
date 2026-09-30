"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getAssessmentReminder, saveAssessmentReminder } from "../services/progress-service";

export function useAssessmentReminder(athleteId: string | undefined) {
  return useQuery({
    queryKey: ["progress", "reminder", athleteId],
    queryFn: () => getAssessmentReminder(athleteId!),
    enabled: !!athleteId,
  });
}

export function useSaveAssessmentReminder(athleteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { intervalWeeks: number; isActive: boolean }) =>
      saveAssessmentReminder(athleteId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["progress", "reminder", athleteId] });
    },
  });
}
