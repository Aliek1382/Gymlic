"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { CONVERSATION_POLL_MS, INBOX_POLL_MS } from "@/lib/api/polling";
import {
  addTicketMessage,
  createTicket,
  getTicket,
  listMyTickets,
  listTicketTrainers,
  listTrainerTickets,
  setTicketStatus,
} from "../services/ticket-service";
import type { TicketStatus } from "../types/ticket-types";

const ticketsKey = ["tickets"] as const;

/** `role` picks the endpoint: the trainer's inbox or the athlete's own list. */
export function useTicketList(role: "athlete" | "trainer", status?: TicketStatus) {
  return useQuery({
    queryKey: [...ticketsKey, "list", role, status ?? "all"],
    queryFn: () => (role === "athlete" ? listMyTickets() : listTrainerTickets(status)),
    refetchInterval: INBOX_POLL_MS,
  });
}

export function useTicketTrainers(enabled: boolean) {
  return useQuery({
    queryKey: [...ticketsKey, "trainers"],
    queryFn: listTicketTrainers,
    enabled,
  });
}

export function useTicket(id: string | null) {
  return useQuery({
    queryKey: [...ticketsKey, "detail", id],
    queryFn: () => getTicket(id as string),
    enabled: !!id,
    refetchInterval: CONVERSATION_POLL_MS,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTicket,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketsKey }),
  });
}

export function useAddTicketMessage(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => addTicketMessage(ticketId, body),
    // A message on a closed ticket reopens it server-side, so lists refresh too.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketsKey }),
  });
}

export function useSetTicketStatus(ticketId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: TicketStatus) => setTicketStatus(ticketId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketsKey }),
  });
}
