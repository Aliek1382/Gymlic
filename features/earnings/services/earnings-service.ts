import { createClient } from "@/lib/supabase/client";
import { getPersianMonthLabel } from "@/lib/persian";
import { trendFromChange } from "@/features/dashboard/utils/trend";
import { parseIsoDate, toIsoDate } from "../utils/iso-date";
import type {
  EarningsPoint,
  TrainerEarningsSummary,
  TrainerPayment,
  TrainerPaymentInput,
} from "../types/earnings-types";

// trainer_payments has two foreign keys into profiles (trainer_id and
// athlete_id) — the embed must be disambiguated via the column hint, or
// PostgREST rejects the query as ambiguous.
const SELECT_COLUMNS =
  "id, athlete_id, amount_toman, paid_at, note, profiles!athlete_id(first_name, last_name)";

const DELETED_ATHLETE_LABEL = "ورزشکار حذف‌شده";

interface PaymentRow {
  id: string;
  athlete_id: string | null;
  amount_toman: number;
  paid_at: string;
  note: string | null;
  profiles: { first_name: string | null; last_name: string | null } | null;
}

async function getCurrentUserId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("نشست کاربر معتبر نیست.");
  return user.id;
}

/** "YYYY-MM" — the key every monthly bucket below groups on. */
function monthKey(date: Date): string {
  return toIsoDate(date).slice(0, 7);
}

function mapRow(row: PaymentRow): TrainerPayment {
  const name = [row.profiles?.first_name, row.profiles?.last_name]
    .filter(Boolean)
    .join(" ");
  return {
    id: row.id,
    athleteId: row.athlete_id,
    athleteName: name || (row.athlete_id ? "ورزشکار" : DELETED_ATHLETE_LABEL),
    amountToman: Number(row.amount_toman),
    paidAt: row.paid_at,
    note: row.note,
  };
}

/** Newest payment first — the order the ledger reads in. */
export async function listTrainerPayments(): Promise<TrainerPayment[]> {
  const supabase = createClient();
  const trainerId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("trainer_payments")
    .select(SELECT_COLUMNS)
    .eq("trainer_id", trainerId)
    .order("paid_at", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<PaymentRow[]>();
  if (error) throw error;

  return (data ?? []).map(mapRow);
}

export async function addTrainerPayment(
  input: TrainerPaymentInput
): Promise<{ id: string }> {
  const supabase = createClient();
  const trainerId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("trainer_payments")
    .insert({
      trainer_id: trainerId,
      athlete_id: input.athleteId,
      amount_toman: input.amountToman,
      paid_at: input.paidAt,
      note: input.note,
    })
    .select("id")
    .single();
  if (error) throw error;

  return { id: data.id };
}

// .select().single() after the write turns a row RLS silently excluded
// (someone else's payment) into an error instead of a quiet no-op.
export async function updateTrainerPayment(
  id: string,
  input: TrainerPaymentInput
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("trainer_payments")
    .update({
      athlete_id: input.athleteId,
      amount_toman: input.amountToman,
      paid_at: input.paidAt,
      note: input.note,
    })
    .eq("id", id)
    .select("id")
    .single();
  if (error) throw error;
}

export async function deleteTrainerPayment(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("trainer_payments")
    .delete()
    .eq("id", id)
    .select("id")
    .single();
  if (error) throw error;
}

/**
 * Every number the earnings cards show, from a single 12-month fetch — the
 * current/previous month, the rolling year, the sparkline buckets and the
 * paying-athlete count all live inside that same window.
 */
export async function getTrainerEarningsSummary(): Promise<TrainerEarningsSummary> {
  const supabase = createClient();
  const trainerId = await getCurrentUserId();

  const now = new Date();
  const windowStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const { data, error } = await supabase
    .from("trainer_payments")
    .select("amount_toman, paid_at, athlete_id")
    .eq("trainer_id", trainerId)
    .gte("paid_at", toIsoDate(windowStart));
  if (error) throw error;

  const rows = data ?? [];
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
    const amount = Number(row.amount_toman);
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
export async function getTrainerEarningsSeries(
  months = 6
): Promise<EarningsPoint[]> {
  const supabase = createClient();
  const trainerId = await getCurrentUserId();

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const { data, error } = await supabase
    .from("trainer_payments")
    .select("amount_toman, paid_at")
    .eq("trainer_id", trainerId)
    .gte("paid_at", toIsoDate(start));
  if (error) throw error;

  const totals = new Map<string, number>();
  for (const row of data ?? []) {
    const key = row.paid_at.slice(0, 7);
    totals.set(key, (totals.get(key) ?? 0) + Number(row.amount_toman));
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
