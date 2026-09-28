import { api, fullName, query, type ListResponse } from "@/lib/api/client";
import type { InvoiceStatus } from "@/features/invoices/types/invoice-types";
import type {
  CreateSessionPackageInput,
  PackageSession,
  SessionPackage,
  SessionPackageStatus,
  SessionStatus,
} from "../types/session-package-types";

interface PackageRow {
  id: string;
  athlete_id: string;
  trainer_first_name: string | null;
  trainer_last_name: string | null;
  title: string;
  total_sessions: number;
  price_toman: number;
  discount_toman: number;
  status: SessionPackageStatus;
  invoice_id: string | null;
  invoice_status: InvoiceStatus | null;
  done_sessions: number;
  canceled_sessions: number;
  created_at: string;
}

interface SessionRow {
  id: string;
  package_id: string;
  scheduled_at: string | null;
  status: SessionStatus;
  note: string | null;
}

function toPackage(row: PackageRow): SessionPackage {
  return {
    id: row.id,
    athleteId: row.athlete_id,
    trainerName: fullName(row.trainer_first_name, row.trainer_last_name, "مربی"),
    title: row.title,
    totalSessions: row.total_sessions,
    priceToman: row.price_toman,
    discountToman: row.discount_toman,
    amountToman: row.price_toman - row.discount_toman,
    status: row.status,
    invoiceId: row.invoice_id,
    invoiceStatus: row.invoice_status,
    doneSessions: row.done_sessions,
    canceledSessions: row.canceled_sessions,
    createdAt: row.created_at,
  };
}

function toSession(row: SessionRow): PackageSession {
  return {
    id: row.id,
    packageId: row.package_id,
    scheduledAt: row.scheduled_at,
    status: row.status,
    note: row.note,
  };
}

export async function createSessionPackage(
  input: CreateSessionPackageInput
): Promise<{ id: string; invoiceId: string }> {
  const data = await api.post<{ id: string; invoice_id: string }>("/session-packages", {
    athlete_id: input.athleteId,
    title: input.title,
    total_sessions: input.totalSessions,
    price_toman: input.priceToman,
    discount_toman: input.discountToman,
  });
  return { id: data.id, invoiceId: data.invoice_id };
}

/** The trainer's packages for one athlete. */
export async function listSessionPackages(athleteId: string): Promise<SessionPackage[]> {
  const data = await api.get<ListResponse<PackageRow>>(
    `/session-packages${query({ athlete_id: athleteId })}`
  );
  return data.items.map(toPackage);
}

export async function listMySessionPackages(): Promise<SessionPackage[]> {
  const data = await api.get<ListResponse<PackageRow>>("/session-packages/mine");
  return data.items.map(toPackage);
}

export async function listPackageSessions(packageId: string): Promise<PackageSession[]> {
  const data = await api.get<ListResponse<SessionRow>>(`/session-packages/${packageId}/sessions`);
  return data.items.map(toSession);
}

/** `scheduledAt` is "YYYY-MM-DD HH:MM"; null takes a planned session back to unscheduled. */
export async function updateSession(input: {
  packageId: string;
  sessionId: string;
  scheduledAt?: string | null;
  status?: SessionStatus;
}): Promise<void> {
  const body: Record<string, unknown> = {};
  if (input.scheduledAt !== undefined) body.scheduled_at = input.scheduledAt;
  if (input.status !== undefined) body.status = input.status;

  await api.patch(`/session-packages/${input.packageId}/sessions/${input.sessionId}`, body);
}
