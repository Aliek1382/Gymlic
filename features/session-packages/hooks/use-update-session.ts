"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateSession } from "../services/session-package-service";
import { invalidateSessionPackageViews } from "./invalidate-session-package-views";

export function useUpdateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSession,
    onSuccess: () => invalidateSessionPackageViews(queryClient),
  });
}
