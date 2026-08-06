"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteTemplate } from "../services/athlete-service";
import type { PlanKind } from "../types/athlete-types";

export function useDeleteTemplate(kind: PlanKind) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (templateId: string) => deleteTemplate(kind, templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["athletes", "templates", kind] });
    },
  });
}
