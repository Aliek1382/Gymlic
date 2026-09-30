"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { setQuestionnaireActive } from "../services/questionnaire-service";
import { invalidateQuestionnaireViews } from "./invalidate-questionnaire-views";

export function useSetQuestionnaireActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setQuestionnaireActive(id, isActive),
    onSuccess: () => invalidateQuestionnaireViews(queryClient),
  });
}
