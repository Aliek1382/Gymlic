"use client";

import { useQuery } from "@tanstack/react-query";

import { listExercisesForPicker } from "../services/exercise-service";

export function useExercisesForPicker() {
  return useQuery({
    queryKey: ["exercises", "picker"],
    queryFn: listExercisesForPicker,
  });
}
