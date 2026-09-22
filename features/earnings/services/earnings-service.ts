import { api, fullName, type ListResponse } from "@/lib/api/client";
import { getPersianMonthLabel } from "@/lib/persian";
import { trendFromChange } from "@/features/dashboard/utils/trend";
import { parseIsoDate, toIsoDate } from "@/lib/iso-date";
import type {
  EarningsPoint,
  TrainerEarningsSummary,
  TrainerPayment,
  TrainerPaymentInput,
} from "../types/earnings-types";

const DELETED_ATHLETE_LABEL = "ورزشکار حذف‌شده";

interface PaymentRow {
  id: string;
  athlete_id: string | null;
  amount_toman: number;
  paid_at: string;
  note: string | null;
  first_name: string | null;
  last_name: string | null;
}

/** "YYYY-MM" — the key every monthly bucket below groups on. */
function monthKey(date: Date): string {
  return toIsoDate(date).slice(0, 7);
}

function mapRow(row: PaymentRow): TrainerPayment {
  return {
    id: row.id,
    athleteId: row.athlete_id,
    athleteName: fullName(
      row.first_name,
      row.last_name,
      row.athlete_id ? "ورزشکار" : DELETED_ATHLETE_LABEL
    ),
    amountToman: row.amount_toman,
    paidAt: row.paid_at,
    note: row.note,
  };
}

function toPayload(input: TrainerPaymentInput) {
  return {
    athlete_id: input.athleteId,
    amount_toman: input.amountToman,
    paid_at: input.paidAt,
    note: input.note,
  };
}

async function listRows(): Promise<PaymentRow[]> {
  const data = await api.get<ListResponse<PaymentRow>>("/earnings");
  return data.items;
}

/** Newest payment first — the order the ledger reads in. */
export async function listTrainerPayments(): Promise<TrainerPayment[]> {
  return (await listRows()).map(mapRow);
}

export async function addTrainerPayment(
  input: TrainerPaymentInput
): Promise<{ id: string }> {
  return api.post<{ id: string }>("/earnings", toPayload(input));
}

export async function updateTrainerPayment(
  id: string,
  input: TrainerPaymentInput
): Promise<void> {
  await api.patch(`/earnings/${id}`, toPayload(input));
}

export async function deleteTrainerPayment(id: string): Promise<void> {
  await api.delete(`/earnings/${id}`);
}

/**
 * Every number the earnings cards show, from the ledger the page already
 * fetches — the current/previous month, the rolling year, the sparkline
 * buckets and the paying-athlete count all live inside that same window.
 */
export async function getTrainerEarningsSummary(): Promise<TrainerEarningsSummary> {
  const now = new Date();
  const windowStart = toIsoDate(new Date(now.getFullYear(), now.getMonth() - 11, 1));
  const rows = (await listRows()).filter((row) => row.paid_at >= windowStart);

  const currentKey = monthKey(now);
  const previousKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  let currentMonth = 0;
  let previousMonth = 0;
  let lastTwelveMonths = 0;
  const payingAthletes = new Set<string>();
  // Five weekly buckets across the last 35 days, oldest bucket first.
  const weeklySeries: number[] = new Array(5).fill(0);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const row of rows) {
    const amount = row.amount_toman;
    const key = row.paid_at.slice(0, 7);

    lastTwelveMonths += amount;
    if (key === currentKey) {
      currentMonth += amount;
      if (row.athlete_id) payingAthletes.add(row.athlete_id);
    }
    if (key === previousKey) previousMonth += amount;

    const daysAgo = Math.floor(
      (today.getTime() - parseIsoDate(row.paid_at).getTime()) / 86_400_000
    );
    // A payment dated in the future (a fee taken in advance) still belongs
    // in the newest bucket rather than off the end of the array.
    if (daysAgo < 35) {
      const bucketIndex = Math.min(4, Math.max(0, Math.floor(daysAgo / 7)));
      weeklySeries[4 - bucketIndex] += amount;
    }
  }

  return {
    currentMonth,
    previousMonth,
    currentMonthTrend: trendFromChange(currentMonth, previousMonth),
    lastTwelveMonths,
    weeklySeries,
    payingAthletesThisMonth: payingAthletes.size,
  };
}

/** Month-by-month totals for the earnings trend chart. */
export async function getTrainerEarningsSeries(months = 6): Promise<EarningsPoint[]> {
  const now = new Date();
  const start = toIsoDate(new Date(now.getFullYear(), now.getMonth() - (months - 1), 1));
  const rows = (await listRows()).filter((row) => row.paid_at >= start);

  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = row.paid_at.slice(0, 7);
    totals.set(key, (totals.get(key) ?? 0) + row.amount_toman);
  }

  const points: EarningsPoint[] = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const bucketDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    points.push({
      label: getPersianMonthLabel(bucketDate),
      value: totals.get(monthKey(bucketDate)) ?? 0,
    });
  }

  // Newest month first so it renders on the right edge of the RTL chart,
  // matching the club revenue chart.
  return points.reverse();
}
