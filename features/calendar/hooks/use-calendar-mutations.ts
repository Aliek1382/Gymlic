"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
} from "../services/calendar-service";
import type { CalendarEventInput } from "../types/calendar-types";

export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CalendarEventInput) => createCalendarEvent(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["calendar"] }),
  });
}

export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CalendarEventInput }) =>
      updateCalendarEvent(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["calendar"] }),
  });
}

export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCalendarEvent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["calendar"] }),
  });
}
