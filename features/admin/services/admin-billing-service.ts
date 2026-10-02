import { ApiError, api, getApiBaseUrl, getToken } from "@/lib/api/client";
import type { AdminClubRow, CatalogPlanRow } from "./admin-service";

// ---------------------------------------------------------------------------
// Payment details clubs see, and the "running out" window
// ---------------------------------------------------------------------------

export interface BillingSettings {
  /** Digits only. */
  card_number: string;
  /** "IR" + 24 digits, or "". */
  sheba: string;
  account_holder: string;
  bank_name: string;
  instructions: string;
  /** Days before expiry a subscription counts as running out. */
  expiring_days: number;
  /** Whether a payment request must carry a receipt image/PDF. */
  receipt_required: boolean;
  /** Size ceiling for a receipt file, in MB. */
  receipt_max_mb: number;
  /** Days after review that receipt files are deleted; 0 keeps them. */
  receipt_retention_days: number;
  /**
   * Whether the plan limits are enforced: invites within each plan's caps,
   * the free plan for trainers without a paid one, and athletes above it put
   * on hold once a paid plan's grace days are over.
   */
  trainer_enforce: boolean;
  /** Days after a paid plan ends during which everything still works. */
  grace_days: number;
}

export const DEFAULT_BILLING_SETTINGS: BillingSettings = {
  card_number: "",
  sheba: "",
  account_holder: "",
  bank_name: "",
  instructions: "",
  expiring_days: 7,
  receipt_required: true,
  receipt_max_mb: 3,
  receipt_retention_days: 7,
  trainer_enforce: false,
  grace_days: 7,
};

export async function getBillingSettings(): Promise<{ settings: BillingSettings; storageReady: boolean }> {
  const data = await api.get<{ settings: { billing?: BillingSettings }; storage_ready: boolean }>(
    "/admin/settings"
  );
  return {
    settings: { ...DEFAULT_BILLING_SETTINGS, ...data.settings.billing },
    storageReady: data.storage_ready,
  };
}

export async function saveBillingSettings(value: BillingSettings): Promise<BillingSettings> {
  const data = await api.put<{ value: BillingSettings }>("/admin/settings/billing", { value });
  return data.value;
}

export interface ReceiptStats {
  /** False until the receipts database update has run. */
  ready: boolean;
  count: number;
  bytes: number;
}

export async function getReceiptStats(): Promise<ReceiptStats> {
  return api.get<ReceiptStats>("/admin/receipts/stats");
}

/** Runs the receipt cleanup now. */
export async function purgeReceipts(): Promise<{ deleted: number; freed_bytes: number }> {
  return api.post("/admin/receipts/purge");
}

/** Deletes one request's receipt file right away (a club's payment request, or a trainer's). */
export async function deleteReceipt(
  requestId: string,
  kind: "payment-request" | "trainer-payment" | "membership-payment" = "payment-request"
): Promise<void> {
  const path = {
    "payment-request": `/admin/payment-requests/${requestId}/receipt`,
    "trainer-payment": `/admin/trainer-billing/requests/${requestId}/receipt`,
    // A club manager deleting a receipt of their own club's member payments.
    "membership-payment": `/member-payments/${requestId}/receipt`,
  }[kind];
  await api.delete(path);
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export async function listSubscriptions(): Promise<{ items: AdminClubRow[]; plans: CatalogPlanRow[] }> {
  return api.get<{ items: AdminClubRow[]; plans: CatalogPlanRow[] }>("/admin/subscriptions");
}

export type SubscriptionChange =
  | { action: "renew"; plan_id: string; amount_toman: number | null }
  | { action: "gift"; days: number }
  | { action: "set"; expires_at: string; plan_name: string; member_capacity: number | null };

export async function updateSubscription(
  clubId: string,
  change: SubscriptionChange,
  options: { note: string; notify: boolean }
): Promise<AdminClubRow | null> {
  const data = await api.post<{ club: AdminClubRow | null }>(`/admin/clubs/${clubId}/subscription`, {
    ...change,
    note: options.note || null,
    notify: options.notify,
  });
  return data.club;
}

export async function giftAllSubscriptions(input: {
  days: number;
  includeExpired: boolean;
  notify: boolean;
  note: string;
}): Promise<number> {
  const data = await api.post<{ count: number }>("/admin/subscriptions/gift", {
    days: input.days,
    include_expired: input.includeExpired,
    notify: input.notify,
    note: input.note || null,
  });
  return data.count;
}

// ---------------------------------------------------------------------------
// Revenue report
// ---------------------------------------------------------------------------

export interface RevenueReport {
  /** Clubs and trainers together. */
  total: number;
  count: number;
  discount_total: number;
  /** The same total split by who paid. */
  sources: {
    clubs: { count: number; total: number };
    trainers: { count: number; total: number };
  };
  /** Newest first; month is the Jalali "1405/07". */
  months: {
    month: string;
    count: number;
    total: number;
    discount: number;
    clubs_total: number;
    trainers_total: number;
  }[];
  plans: { plan_name: string; kind: "club" | "trainer"; count: number; total: number }[];
}

export async function getRevenueReport(): Promise<RevenueReport> {
  return api.get<RevenueReport>("/admin/reports/revenue");
}

// ---------------------------------------------------------------------------
// Discount codes
// ---------------------------------------------------------------------------

export type DiscountKind = "percent" | "amount";

export interface DiscountCodeRow {
  id: string;
  code: string;
  kind: DiscountKind;
  value: number;
  plan_id: string | null;
  plan_name: string | null;
  max_uses: number | null;
  once_per_club: boolean;
  expires_at: string | null;
  is_active: boolean;
  note: string | null;
  created_at: string;
  /** Pending + approved requests that carry the code. */
  uses: number;
  /** Toman off across approved requests. */
  total_discount: number;
}

export interface DiscountCodeInput {
  code: string;
  kind: DiscountKind;
  value: number;
  plan_id: string | null;
  max_uses: number | null;
  once_per_club: boolean;
  /** YYYY-MM-DD; the code works through the end of that day. */
  expires_at: string | null;
  is_active: boolean;
  note: string;
}

export async function listDiscountCodes(): Promise<{
  ready: boolean;
  items: DiscountCodeRow[];
  plans: Pick<CatalogPlanRow, "id" | "name" | "price_toman" | "is_active">[];
}> {
  return api.get("/admin/discounts");
}

export async function createDiscountCode(input: DiscountCodeInput) {
  await api.post("/admin/discounts", input);
}

export async function updateDiscountCode(id: string, input: DiscountCodeInput) {
  await api.patch(`/admin/discounts/${id}`, input);
}

export async function deleteDiscountCode(id: string) {
  await api.delete(`/admin/discounts/${id}`);
}

// ---------------------------------------------------------------------------
// CSV exports
// ---------------------------------------------------------------------------

export type ExportKind =
  | "users"
  | "payments"
  | "trainer-payments"
  | "subscriptions"
  | "trainer-subscriptions"
  | "revenue";

/**
 * Like the database backup, a CSV is a file rather than JSON: fetched with
 * the session token and handed to the browser as a download.
 */
export async function downloadExport(kind: ExportKind): Promise<void> {
  const token = getToken();
  const response = await fetch(`${getApiBaseUrl()}/admin/export/${kind}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(
      payload?.error?.message ?? "دریافت فایل ناموفق بود.",
      response.status,
      payload?.error?.code ?? "export_failed"
    );
  }

  const blob = await response.blob();
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `gymlic-${kind}-${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
