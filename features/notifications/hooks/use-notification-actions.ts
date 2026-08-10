"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notification-service";
import { notificationsQueryKey } from "./use-notifications";
import type { NotificationItem } from "../types/notification-types";

export function useMarkNotificationRead(userId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = notificationsQueryKey(userId);

  return useMutation({
    mutationFn: markNotificationRead,
    onMutate: async (id: string) => {
      queryClient.setQueryData<NotificationItem[]>(queryKey, (current) =>
        current?.map((notification) =>
          notification.id === id ? { ...notification, isRead: true } : notification
        )
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useMarkAllNotificationsRead(userId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = notificationsQueryKey(userId);

  return useMutation({
    mutationFn: () => markAllNotificationsRead(userId as string),
    onMutate: async () => {
      queryClient.setQueryData<NotificationItem[]>(queryKey, (current) =>
        current?.map((notification) => ({ ...notification, isRead: true }))
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
