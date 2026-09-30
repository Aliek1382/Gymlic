"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { submitQuestionnaire } from "../services/questionnaire-service";
import { invalidateQuestionnaireViews } from "./invalidate-questionnaire-views";

export function useSubmitQuestionnaire() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitQuestionnaire,
    onSuccess: () => invalidateQuestionnaireViews(queryClient),
  });
}
