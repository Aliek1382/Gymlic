import type { InvoiceStatus } from "@/features/invoices/types/invoice-types";

export type SessionPackageStatus = "pending_payment" | "active" | "completed" | "cancelled";
export type SessionStatus = "unscheduled" | "scheduled" | "done" | "canceled";

export interface SessionPackage {
  id: string;
  athleteId: string;
  trainerName: string;
  title: string;
  totalSessions: number;
  priceToman: number;
  discountToman: number;
  /** What the invoice asks for: price minus discount. */
  amountToman: number;
  status: SessionPackageStatus;
  invoiceId: string | null;
  invoiceStatus: InvoiceStatus | null;
  doneSessions: number;
  canceledSessions: number;
  createdAt: string;
}

export interface PackageSession {
  id: string;
  packageId: string;
  /** Local "YYYY-MM-DD HH:MM:SS" as stored, or null until the trainer plans it. */
  scheduledAt: string | null;
  status: SessionStatus;
  note: string | null;
}

export interface CreateSessionPackageInput {
  athleteId: string;
  title: string;
  totalSessions: number;
  priceToman: number;
  discountToman: number;
}
