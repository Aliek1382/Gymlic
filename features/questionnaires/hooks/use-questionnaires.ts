"use client";

import { useQuery } from "@tanstack/react-query";

import { listQuestionnaires } from "../services/questionnaire-service";

/** Trainer side: their own questionnaires. */
export function useQuestionnaires() {
  return useQuery({
    queryKey: ["questionnaires", "trainer"],
    queryFn: listQuestionnaires,
  });
}
