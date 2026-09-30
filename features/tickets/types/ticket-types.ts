// A ticket is a formal athlete → trainer request, kept apart from the free
// chat in `messages`: it has a category, a status and a tracking number.
export type TicketCategory = "plan" | "nutrition" | "injury" | "other";
export type TicketStatus = "open" | "in_progress" | "closed";

export interface Ticket {
  id: string;
  ticketNumber: number;
  category: TicketCategory;
  subject: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  trainerId: string;
  athleteId: string;
  trainerName: string;
  athleteName: string;
}

export interface TicketMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  body: string;
  createdAt: string;
}

export interface TicketDetail {
  ticket: Ticket;
  messages: TicketMessage[];
}

export interface TicketTrainerOption {
  id: string;
  name: string;
}
