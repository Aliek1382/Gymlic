"use client";

import { useQuery } from "@tanstack/react-query";

import { getQuestionnaireResponses } from "../services/questionnaire-service";

export function useQuestionnaireResponses(id: string | null) {
  return useQuery({
    queryKey: ["questionnaires", "responses", id],
    queryFn: () => getQuestionnaireResponses(id as string),
    enabled: id !== null,
  });
}
