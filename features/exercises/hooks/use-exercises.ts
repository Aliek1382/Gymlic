"use client";

import { useQuery } from "@tanstack/react-query";

import { listExercises } from "../services/exercise-service";

export function useExercises() {
  return useQuery({
    queryKey: ["exercises", "list"],
    queryFn: listExercises,
  });
}
