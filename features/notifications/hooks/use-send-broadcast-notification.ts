"use client";

import { useMutation } from "@tanstack/react-query";

import { sendBroadcastNotification } from "../services/notification-service";

export function useSendBroadcastNotification() {
  return useMutation({
    mutationFn: sendBroadcastNotification,
  });
}
