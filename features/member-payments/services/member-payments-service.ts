import { api } from "@/lib/api/client";
import type { PaymentAccount } from "@/features/finance/components/payment-account-card";
import type { ReceiptRules } from "@/features/finance/services/finance-service";

export type MemberPaymentStatus = "pending" | "approved" | "rejected";
export type MembershipState = "active" | "expiring" | "expired";

export interface MembershipPlanOption {
  id: string;
  name: string;
  price_toman: number;
  duration_days: number;
  description: string | null;
}

export interface MyMemberPayment {
  id: string;
  plan_name: string;
  amount_toman: number;
  tracking_code: string;
  card_last4: string;
  paid_at: string | null;
  note: string | null;
  status: MemberPaymentStatus;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  has_receipt: boolean;
  receipt_is_pdf: boolean;
  receipt_purged_at: string | null;
}

/** One club the athlete belongs to, with what they need to renew. */
export interface MyClubMembership {
  membership_id: string;
  club_id: string;
  club_name: string;
  plan_name: string | null;
  /** YYYY-MM-DD, null = no expiry. */
  expires_at: string | null;
  status: MembershipState | null;
  remaining_days: number | null;
  pay_to: PaymentAccount | null;
  plans: MembershipPlanOption[];
  requests: MyMemberPayment[];
}

export interface MyMembershipPayments {
  /** False until the server's database has the member-payment tables. */
  ready: boolean;
  clubs?: MyClubMembership[];
  receipts?: ReceiptRules;
}

export async function getMyMembershipPayments(): Promise<MyMembershipPayments> {
  return api.get<MyMembershipPayments>("/member-payments/mine");
}

export async function submitMemberPayment(input: {
  planId: string;
  trackingCode: string;
  cardLast4: string;
  paidAt?: string;
  note?: string;
  receipt?: File | null;
}): Promise<void> {
  const fields: Record<string, string> = {
    plan_id: input.planId,
    tracking_code: input.trackingCode,
    card_last4: input.cardLast4,
  };
  if (input.paidAt) fields.paid_at = input.paidAt;
  if (input.note) fields.note = input.note;

  if (input.receipt) {
    await api.upload("/member-payments", input.receipt, fields, "receipt");
  } else {
    await api.post("/member-payments", fields);
  }
}

// ---------------------------------------------------------------------------
// Club side
// ---------------------------------------------------------------------------

export interface ClubMemberPayment extends MyMemberPayment {
  athlete_id: string;
  duration_days: number;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  duplicate_tracking: boolean;
  receipt_expires_at: string | null;
}

export async function listClubMemberPayments(
  clubId: string
): Promise<{ ready: boolean; items: ClubMemberPayment[] }> {
  return api.get(`/clubs/${clubId}/member-payments`);
}

export async function approveMemberPayment(id: string, note?: string): Promise<void> {
  await api.post(`/member-payments/${id}/approve`, { note: note || null });
}

export async function rejectMemberPayment(id: string, note?: string): Promise<void> {
  await api.post(`/member-payments/${id}/reject`, { note: note || null });
}

export async function getClubPaymentInfo(
  clubId: string
): Promise<{ ready: boolean; info: PaymentAccount }> {
  return api.get(`/clubs/${clubId}/payment-info`);
}

export async function saveClubPaymentInfo(clubId: string, info: PaymentAccount): Promise<void> {
  await api.put(`/clubs/${clubId}/payment-info`, info);
}
