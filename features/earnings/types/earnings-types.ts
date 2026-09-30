import type { StatTrend } from "@/features/dashboard/types/dashboard-types";

export type PaymentMethod = "cash" | "card_transfer" | "online";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "نقدی",
  card_transfer: "کارت‌به‌کارت",
  online: "آنلاین",
};

/** One fee a trainer recorded receiving from one of their athletes. */
export interface TrainerPayment {
  id: string;
  /** Null only when the athlete later deleted their account. */
  athleteId: string | null;
  athleteName: string;
  amountToman: number;
  paymentMethod: PaymentMethod;
  /** ISO date (no time) — the day the money changed hands. */
  paidAt: string;
  note: string | null;
}

export interface TrainerPaymentInput {
  athleteId: string;
  amountToman: number;
  paymentMethod: PaymentMethod;
  paidAt: string;
  note: string | null;
}

/** One server-side bucket of the financial report: a month × a payment method. */
export interface FinancialSummaryRow {
  /** Gregorian "YYYY-MM", as grouped by the server. */
  month: string;
  paymentMethod: PaymentMethod;
  totalToman: number;
  count: number;
}

/** Everything the earnings cards need, in one round-trip. */
export interface TrainerEarningsSummary {
  currentMonth: number;
  previousMonth: number;
  currentMonthTrend: StatTrend;
  /** Last 12 months, for the "درآمد یک سال گذشته" card. */
  lastTwelveMonths: number;
  /** Five weekly buckets over the last 35 days, for the card sparkline. */
  weeklySeries: number[];
  /** How many distinct athletes paid at least once this month. */
  payingAthletesThisMonth: number;
}

/** One point on the earnings trend chart. */
export interface EarningsPoint {
  label: string;
  value: number;
}
