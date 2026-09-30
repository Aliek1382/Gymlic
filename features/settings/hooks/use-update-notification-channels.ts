"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateNotificationChannels } from "../services/settings-service";

export function useUpdateNotificationChannels() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateNotificationChannels,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "profile"] });
    },
  });
}
