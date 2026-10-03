import { api } from "@/lib/api/client";
import type {
  DiscountCodeInput,
  DiscountCodeRow,
} from "@/features/admin/services/admin-billing-service";
import type { PaymentAccount } from "@/features/finance/components/payment-account-card";
import type { DiscountQuote, ReceiptRules } from "@/features/finance/services/finance-service";

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
  paid_amount_toman?: number | null;
  note: string | null;
  status: MemberPaymentStatus;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  has_receipt: boolean;
  receipt_is_pdf: boolean;
  receipt_purged_at: string | null;
  /** Present once the discount-code database update has run. */
  list_price_toman?: number | null;
  discount_toman?: number;
  discount_code?: string | null;
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
  /** False until the club discount-code tables exist. */
  discounts_enabled?: boolean;
  clubs?: MyClubMembership[];
  receipts?: ReceiptRules;
}

export async function getMyMembershipPayments(): Promise<MyMembershipPayments> {
  return api.get<MyMembershipPayments>("/member-payments/mine");
}

/** The price a club's discount code gives for a plan, before the athlete files the payment. */
export async function checkMemberDiscount(planId: string, code: string): Promise<DiscountQuote> {
  return api.post<DiscountQuote>("/member-payments/discount-check", { plan_id: planId, code });
}

export async function submitMemberPayment(input: {
  planId: string;
  trackingCode: string;
  cardLast4: string;
  paidAt?: string;
  paidAmount?: number;
  note?: string;
  discountCode?: string;
  receipt?: File | null;
}): Promise<void> {
  const fields: Record<string, string> = {
    plan_id: input.planId,
    tracking_code: input.trackingCode,
    card_last4: input.cardLast4,
  };
  if (input.paidAt) fields.paid_at = input.paidAt;
  if (input.paidAmount) fields.paid_amount = String(input.paidAmount);
  if (input.note) fields.note = input.note;
  if (input.discountCode) fields.discount_code = input.discountCode;

  if (input.receipt) {
    await api.upload("/member-payments", input.receipt, fields, "receipt");
  } else {
    await api.post("/member-payments", fields);
  }
}

/** The athlete takes back a payment the club has not answered yet. */
export async function cancelMemberPayment(id: string): Promise<void> {
  await api.delete(`/member-payments/${id}`);
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
  amount_mismatch?: boolean;
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

// ---------------------------------------------------------------------------
// The club's discount codes
// ---------------------------------------------------------------------------

// The server calls the once-per-person rule once_per_member; the discount
// dialog shared with the other codes calls it once_per_club, so it is renamed
// here in both directions.
type ClubDiscountRow = Omit<DiscountCodeRow, "once_per_club"> & { once_per_member: boolean };

export async function listClubDiscounts(clubId: string): Promise<{
  ready: boolean;
  items: DiscountCodeRow[];
  plans: { id: string; name: string; price_toman: number; is_active: boolean }[];
}> {
  const data = await api.get<{
    ready: boolean;
    items: ClubDiscountRow[];
    plans: { id: string; name: string; price_toman: number; is_active: boolean }[];
  }>(`/clubs/${clubId}/discount-codes`);
  return {
    ...data,
    items: data.items.map(({ once_per_member, ...row }) => ({ ...row, once_per_club: once_per_member })),
  };
}

function toClubDiscountPayload({ once_per_club, ...input }: DiscountCodeInput) {
  return { ...input, once_per_member: once_per_club };
}

export async function createClubDiscount(clubId: string, input: DiscountCodeInput): Promise<void> {
  await api.post(`/clubs/${clubId}/discount-codes`, toClubDiscountPayload(input));
}

export async function updateClubDiscount(clubId: string, id: string, input: DiscountCodeInput): Promise<void> {
  await api.patch(`/clubs/${clubId}/discount-codes/${id}`, toClubDiscountPayload(input));
}

export async function deleteClubDiscount(clubId: string, id: string): Promise<void> {
  await api.delete(`/clubs/${clubId}/discount-codes/${id}`);
}
