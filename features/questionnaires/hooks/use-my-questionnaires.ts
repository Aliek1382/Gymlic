"use client";

import { useQuery } from "@tanstack/react-query";

import { listMyQuestionnaires } from "../services/questionnaire-service";

export function useMyQuestionnaires() {
  return useQuery({
    queryKey: ["questionnaires", "mine"],
    queryFn: listMyQuestionnaires,
  });
}
