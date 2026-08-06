"use client";

import { useQuery } from "@tanstack/react-query";

import { listExercises } from "../services/exercise-service";

export function useExercises(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["exercises", "list"],
    queryFn: listExercises,
    enabled: options?.enabled ?? true,
  });
}
