"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteQuestionnaire } from "../services/questionnaire-service";
import { invalidateQuestionnaireViews } from "./invalidate-questionnaire-views";

export function useDeleteQuestionnaire() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteQuestionnaire,
    onSuccess: () => invalidateQuestionnaireViews(queryClient),
  });
}
