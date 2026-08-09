"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { addMeasurement } from "../services/progress-service";
import type { MeasurementInput } from "../types/progress-types";

export function useAddMeasurement(athleteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: MeasurementInput) => addMeasurement(athleteId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["progress", "measurements", athleteId],
      });
    },
  });
}
