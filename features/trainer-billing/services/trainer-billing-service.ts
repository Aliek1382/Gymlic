import { api } from "@/lib/api/client";
import type {
  DiscountCodeInput,
  DiscountCodeRow,
} from "@/features/admin/services/admin-billing-service";
import type {
  DiscountQuote,
  PaymentInfo,
  ReceiptRules,
} from "@/features/finance/services/finance-service";

export type TrainerRequestStatus = "pending" | "approved" | "rejected";
export type TrainerSubscriptionStatus = "active" | "expiring" | "grace" | "expired";
export type ReportLevel = "count" | "basic" | "full" | "full_excel";

export interface TrainerPlan {
  id: string;
  name: string;
  price_toman: number;
  duration_days: number;
  /** null = no cap on athletes. */
  max_athletes: number | null;
  is_active?: boolean;
  /** The plan every trainer has without paying (admin list only). */
  is_free?: boolean;
  /** Read by later phases; null = unlimited. Present once the plan-limits update ran. */
  max_custom_exercises?: number | null;
  max_templates?: number | null;
  history_months?: number | null;
  report_level?: ReportLevel | null;
  /** Admin list: trainers whose subscription is on this plan. */
  subscriber_count?: number;
}

export interface TrainerSubscription {
  plan_name: string;
  max_athletes: number | null;
  started_at: string;
  /** null on the free plan, which never ends. */
  expires_at: string | null;
  status: TrainerSubscriptionStatus;
  remaining_days: number | null;
}

/**
 * What the trainer's plan allows right now (server: Limits::forTrainer).
 * status "expired" means a paid plan and its grace days are over, so the
 * free plan applies; the free plan itself is always "active".
 */
export interface TrainerLimits {
  /** False until the plan-limits database update has run. */
  ready: boolean;
  enforcing: boolean;
  plan: {
    id: string | null;
    name: string | null;
    is_free: boolean;
    max_athletes: number | null;
    max_custom_exercises: number | null;
    max_templates: number | null;
    history_months: number | null;
    report_level: ReportLevel | null;
  };
  status: TrainerSubscriptionStatus | null;
  /** The stored subscription row, paid or free; null for a trainer who never had one. */
  subscription: {
    plan_id: string | null;
    plan_name: string;
    is_free: boolean;
    started_at: string;
    expires_at: string | null;
    remaining_days: number | null;
    grace_ends_at: string | null;
    override_on: boolean;
    override_max_athletes: number | null;
    downgraded: boolean;
  } | null;
  /** An admin's cap is in effect instead of the plan's. */
  override: boolean;
  /** The cap in effect; null = unlimited. */
  max_athletes: number | null;
  free_max_athletes: number | null;
  usage: { active: number; pending_invites: number; suspended: number };
  over_cap: boolean;
  /** While a paid plan or its grace days run: athletes that would be suspended when it ends. */
  suspend_after_grace: number;
  club: { club_id: string; name: string } | null;
  /**
   * The trainer's own custom exercises and templates (workout and nutrition
   * together) against the plan's caps; max null = unlimited. via_club: the
   * trainer's club has a plan running, which lifts both caps.
   */
  /**
   * Finished plans assigned before cutoff are hidden from the trainer
   * (history_months of the plan in effect); null = none. hidden: how many,
   * in the admin's list only.
   */
  history?: { months: number | null; cutoff: string | null; hidden?: number };
  /**
   * Report sections (phase 4). level: the plan's (null = unlimited).
   * effective: what applies now; full_excel while enforcement is off or the
   * trainer's club has a plan running.
   */
  reports?: { level: ReportLevel | null; effective: ReportLevel };
  content: {
    via_club: boolean;
    exercises: ContentUsage;
    templates: ContentUsage;
  } | null;
}

export interface ContentUsage {
  used: number;
  max: number | null;
  /** Above the cap (after a paid plan ended): kept and usable, only new ones are refused. */
  over: boolean;
}

export interface TrainerPaymentRequest {
  id: string;
  plan_id: string;
  plan_name: string;
  amount_toman: number;
  reference_note: string | null;
  tracking_code: string;
  card_last4: string;
  paid_at: string | null;
  status: TrainerRequestStatus;
  admin_note: string | null;
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

export interface TrainerBillingOverview {
  /** False until the server's database has the trainer-subscription tables. */
  ready: boolean;
  enforcing?: boolean;
  /** A trainer in a club is covered by the club's subscription. */
  in_club?: boolean;
  subscription?: TrainerSubscription | null;
  athletes?: { active: number; pending_invites: number };
  limits?: TrainerLimits;
  plans?: TrainerPlan[];
  requests?: TrainerPaymentRequest[];
  /** False until the discount-code tables exist. */
  discounts_enabled?: boolean;
  receipts?: ReceiptRules;
  payment?: PaymentInfo;
}

export async function getTrainerBilling(): Promise<TrainerBillingOverview> {
  return api.get<TrainerBillingOverview>("/trainer-billing");
}

/** The price a discount code gives for a plan, before the trainer files the payment. */
export async function checkTrainerDiscount(planId: string, code: string): Promise<DiscountQuote> {
  return api.post<DiscountQuote>("/trainer-billing/discount-check", { plan_id: planId, code });
}

export async function submitTrainerPayment(input: {
  planId: string;
  /** Not needed when a discount code covers the whole price. */
  trackingCode?: string;
  cardLast4?: string;
  paidAt?: string;
  note?: string;
  discountCode?: string;
  receipt?: File | null;
}): Promise<void> {
  const fields: Record<string, string> = { plan_id: input.planId };
  if (input.trackingCode) fields.tracking_code = input.trackingCode;
  if (input.cardLast4) fields.card_last4 = input.cardLast4;
  if (input.paidAt) fields.paid_at = input.paidAt;
  if (input.note) fields.reference_note = input.note;
  if (input.discountCode) fields.discount_code = input.discountCode;

  if (input.receipt) {
    await api.upload("/trainer-billing/requests", input.receipt, fields, "receipt");
  } else {
    await api.post("/trainer-billing/requests", fields);
  }
}

export interface KeepListAthlete {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  last_seen_at: string | null;
  suspended_by_plan: boolean;
  keep_on_downgrade: boolean;
  created_at: string;
}

/** The athletes coached outside a club, for picking who stays active on the free plan. */
export async function getKeepList(): Promise<{ ready: boolean; limits?: TrainerLimits; items: KeepListAthlete[] }> {
  return api.get("/trainer-billing/athletes");
}

export async function saveKeepList(athleteIds: string[]): Promise<void> {
  await api.post("/trainer-billing/athletes", { keep: athleteIds });
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface AdminTrainerRequest extends TrainerPaymentRequest {
  trainer_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  duplicate_tracking: boolean;
  receipt_expires_at: string | null;
}

export async function listTrainerRequests(): Promise<{ ready: boolean; items: AdminTrainerRequest[] }> {
  return api.get("/admin/trainer-billing/requests");
}

export async function approveTrainerRequest(id: string, adminNote?: string): Promise<void> {
  await api.post(`/admin/trainer-billing/requests/${id}/approve`, { admin_note: adminNote || null });
}

export async function rejectTrainerRequest(id: string, adminNote?: string): Promise<void> {
  await api.post(`/admin/trainer-billing/requests/${id}/reject`, { admin_note: adminNote || null });
}

export async function listAdminTrainerPlans(): Promise<{ ready: boolean; limits?: boolean; items: TrainerPlan[] }> {
  return api.get("/admin/trainer-plans");
}

export interface TrainerPlanInput {
  name: string;
  priceToman: number;
  durationDays: number;
  maxAthletes: number | null;
  isActive?: boolean;
  maxCustomExercises?: number | null;
  maxTemplates?: number | null;
  historyMonths?: number | null;
  reportLevel?: ReportLevel | null;
}

function toPlanPayload(input: Partial<TrainerPlanInput>) {
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.priceToman !== undefined) payload.price_toman = input.priceToman;
  if (input.durationDays !== undefined) payload.duration_days = input.durationDays;
  if (input.maxAthletes !== undefined) payload.max_athletes = input.maxAthletes;
  if (input.isActive !== undefined) payload.is_active = input.isActive;
  if (input.maxCustomExercises !== undefined) payload.max_custom_exercises = input.maxCustomExercises;
  if (input.maxTemplates !== undefined) payload.max_templates = input.maxTemplates;
  if (input.historyMonths !== undefined) payload.history_months = input.historyMonths;
  if (input.reportLevel !== undefined) payload.report_level = input.reportLevel;
  return payload;
}

export async function createTrainerPlan(input: TrainerPlanInput): Promise<void> {
  await api.post("/admin/trainer-plans", toPlanPayload(input));
}

export async function updateTrainerPlan(id: string, input: Partial<TrainerPlanInput>): Promise<void> {
  await api.patch(`/admin/trainer-plans/${id}`, toPlanPayload(input));
}

export interface AdminTrainerSubscriptionRow {
  trainer_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  plan_name: string | null;
  max_athletes: number | null;
  expires_at: string | null;
  status: TrainerSubscriptionStatus | null;
  remaining_days: number | null;
  in_club: boolean;
  athlete_count: number;
}

export async function listTrainerSubscriptions(): Promise<{
  ready: boolean;
  enforcing?: boolean;
  items: AdminTrainerSubscriptionRow[];
}> {
  return api.get("/admin/trainer-billing/subscriptions");
}

/** Free days (keeping the trainer's plan), or a plan by hand when planId is given. */
export async function grantTrainerDays(input: {
  trainerId: string;
  days: number;
  planId?: string | null;
}): Promise<void> {
  await api.post(`/admin/trainer-billing/subscriptions/${input.trainerId}/grant`, {
    days: input.days,
    plan_id: input.planId || null,
  });
}

// ---------------------------------------------------------------------------
// Discount codes (admin)
// ---------------------------------------------------------------------------

// The server calls the once-per-person rule once_per_trainer; the discount
// dialog shared with the club codes calls it once_per_club, so it is renamed
// here in both directions.
type TrainerDiscountRow = Omit<DiscountCodeRow, "once_per_club"> & { once_per_trainer: boolean };

export async function listTrainerDiscounts(): Promise<{
  ready: boolean;
  items: DiscountCodeRow[];
  plans: { id: string; name: string; price_toman: number; is_active: boolean }[];
}> {
  const data = await api.get<{
    ready: boolean;
    items: TrainerDiscountRow[];
    plans: { id: string; name: string; price_toman: number; is_active: boolean }[];
  }>("/admin/trainer-discounts");
  return {
    ...data,
    items: data.items.map(({ once_per_trainer, ...row }) => ({ ...row, once_per_club: once_per_trainer })),
  };
}

function toTrainerDiscountPayload({ once_per_club, ...input }: DiscountCodeInput) {
  return { ...input, once_per_trainer: once_per_club };
}

export async function createTrainerDiscount(input: DiscountCodeInput): Promise<void> {
  await api.post("/admin/trainer-discounts", toTrainerDiscountPayload(input));
}

export async function updateTrainerDiscount(id: string, input: DiscountCodeInput): Promise<void> {
  await api.patch(`/admin/trainer-discounts/${id}`, toTrainerDiscountPayload(input));
}

export async function deleteTrainerDiscount(id: string): Promise<void> {
  await api.delete(`/admin/trainer-discounts/${id}`);
}
