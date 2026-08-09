"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateMeasurement } from "../services/progress-service";
import type { MeasurementInput } from "../types/progress-types";

export function useUpdateMeasurement(athleteId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: MeasurementInput }) =>
      updateMeasurement(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["progress", "measurements", athleteId],
      });
    },
  });
}
