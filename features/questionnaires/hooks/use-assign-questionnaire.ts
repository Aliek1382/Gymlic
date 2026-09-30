"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { assignQuestionnaire } from "../services/questionnaire-service";
import { invalidateQuestionnaireViews } from "./invalidate-questionnaire-views";

export function useAssignQuestionnaire() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: assignQuestionnaire,
    onSuccess: () => invalidateQuestionnaireViews(queryClient),
  });
}
