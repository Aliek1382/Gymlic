import { api, fullName, type ListResponse } from "@/lib/api/client";
import type {
  Ticket,
  TicketCategory,
  TicketDetail,
  TicketStatus,
  TicketTrainerOption,
} from "../types/ticket-types";

interface TicketRow {
  id: string;
  ticket_number: number | string;
  category: TicketCategory;
  subject: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  trainer_id: string;
  athlete_id: string;
  trainer_first_name: string | null;
  trainer_last_name: string | null;
  athlete_first_name: string | null;
  athlete_last_name: string | null;
}

function mapTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    ticketNumber: Number(row.ticket_number),
    category: row.category,
    subject: row.subject,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
    trainerId: row.trainer_id,
    athleteId: row.athlete_id,
    trainerName: fullName(row.trainer_first_name, row.trainer_last_name, "مربی"),
    athleteName: fullName(row.athlete_first_name, row.athlete_last_name, "ورزشکار"),
  };
}

/** The trainer's tickets, optionally narrowed to one status. */
export async function listTrainerTickets(status?: TicketStatus): Promise<Ticket[]> {
  const query = status ? `?status=${status}` : "";
  const data = await api.get<ListResponse<TicketRow>>(`/tickets${query}`);
  return data.items.map(mapTicket);
}

/** The athlete's own tickets. */
export async function listMyTickets(): Promise<Ticket[]> {
  const data = await api.get<ListResponse<TicketRow>>("/tickets/mine");
  return data.items.map(mapTicket);
}

export async function listTicketTrainers(): Promise<TicketTrainerOption[]> {
  const data = await api.get<
    ListResponse<{ id: string; first_name: string | null; last_name: string | null }>
  >("/tickets/trainers");
  return data.items.map((row) => ({
    id: row.id,
    name: fullName(row.first_name, row.last_name, "مربی"),
  }));
}

interface TicketDetailResponse {
  ticket: TicketRow;
  messages: {
    id: string;
    sender_id: string;
    body: string;
    created_at: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  }[];
}

function mapDetail(data: TicketDetailResponse): TicketDetail {
  return {
    ticket: mapTicket(data.ticket),
    messages: data.messages.map((row) => ({
      id: row.id,
      senderId: row.sender_id,
      senderName: fullName(row.first_name, row.last_name, "کاربر"),
      senderAvatarUrl: row.avatar_url,
      body: row.body,
      createdAt: row.created_at,
    })),
  };
}

export async function getTicket(id: string): Promise<TicketDetail> {
  return mapDetail(await api.get<TicketDetailResponse>(`/tickets/${id}`));
}

/** Admin oversight (support permission): every athlete ↔ trainer ticket, read-only. */
export async function listAdminTickets(
  status?: TicketStatus
): Promise<{ items: (Ticket & { messageCount: number })[]; counts: Record<TicketStatus, number> }> {
  const query = status ? `?status=${status}` : "";
  const data = await api.get<{
    items: (TicketRow & { message_count: number | string })[];
    counts: Record<TicketStatus, number>;
  }>(`/admin/tickets${query}`);
  return {
    items: data.items.map((row) => ({ ...mapTicket(row), messageCount: Number(row.message_count) })),
    counts: data.counts,
  };
}

export async function getAdminTicket(id: string): Promise<TicketDetail> {
  return mapDetail(await api.get<TicketDetailResponse>(`/admin/tickets/${id}`));
}

export async function createTicket(input: {
  trainerId: string;
  category: TicketCategory;
  subject: string;
  body: string;
}): Promise<{ id: string; ticketNumber: number }> {
  const data = await api.post<{ id: string; ticket_number: number }>("/tickets", {
    trainer_id: input.trainerId,
    category: input.category,
    subject: input.subject,
    body: input.body,
  });
  return { id: data.id, ticketNumber: Number(data.ticket_number) };
}

export async function addTicketMessage(ticketId: string, body: string): Promise<void> {
  await api.post(`/tickets/${ticketId}/messages`, { body });
}

export async function setTicketStatus(ticketId: string, status: TicketStatus): Promise<void> {
  await api.patch(`/tickets/${ticketId}/status`, { status });
}
