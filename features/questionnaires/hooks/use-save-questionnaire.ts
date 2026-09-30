"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { saveQuestionnaire } from "../services/questionnaire-service";
import { invalidateQuestionnaireViews } from "./invalidate-questionnaire-views";

export function useSaveQuestionnaire() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveQuestionnaire,
    onSuccess: () => invalidateQuestionnaireViews(queryClient),
  });
}
