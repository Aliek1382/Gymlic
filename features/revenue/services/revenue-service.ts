import { createClient } from "@/lib/supabase/client";
import { parseIsoDate, toIsoDate } from "@/lib/iso-date";
import { trendFromChange } from "@/features/dashboard/utils/trend";
import type {
  ClubRevenueSummary,
  RevenueCategory,
  RevenueEntry,
  RevenueEntryInput,
} from "../types/revenue-types";

// revenue_entries has two foreign keys into profiles (member_id and
// recorded_by), so the embed must name the column or PostgREST rejects the
// query as ambiguous.
const SELECT_COLUMNS =
  "id, member_id, amount, category, occurred_at, note, profiles!member_id(first_name, last_name)";

const DELETED_MEMBER_LABEL = "عضو حذف‌شده";

interface RevenueRow {
  id: string;
  member_id: string | null;
  amount: number | string;
  category: RevenueCategory;
  occurred_at: string;
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

/**
 * occurred_at is a timestamptz but the ledger only ever means a calendar
 * day. Storing the picked day at local noon keeps it on that day for every
 * reader, instead of slipping into the neighbouring month for anyone whose
 * offset crosses midnight.
 */
function toOccurredAt(occurredOn: string): string {
  const date = parseIsoDate(occurredOn);
  date.setHours(12, 0, 0, 0);
  return date.toISOString();
}

function toOccurredOn(occurredAt: string): string {
  return toIsoDate(new Date(occurredAt));
}

/** "YYYY-MM" — the key every monthly bucket below groups on. */
function monthKey(date: Date): string {
  return toIsoDate(date).slice(0, 7);
}

function mapRow(row: RevenueRow): RevenueEntry {
  const name = [row.profiles?.first_name, row.profiles?.last_name]
    .filter(Boolean)
    .join(" ");
  return {
    id: row.id,
    memberId: row.member_id,
    memberName: row.member_id ? name || DELETED_MEMBER_LABEL : null,
    amount: Number(row.amount),
    category: row.category,
    occurredOn: toOccurredOn(row.occurred_at),
    note: row.note,
  };
}

/** Newest entry first — the order the ledger reads in. */
export async function listRevenueEntries(
  clubId: string
): Promise<RevenueEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("revenue_entries")
    .select(SELECT_COLUMNS)
    .eq("club_id", clubId)
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<RevenueRow[]>();
  if (error) throw error;

  return (data ?? []).map(mapRow);
}

export async function addRevenueEntry(
  clubId: string,
  input: RevenueEntryInput
): Promise<{ id: string }> {
  const supabase = createClient();
  const recordedBy = await getCurrentUserId();

  const { data, error } = await supabase
    .from("revenue_entries")
    .insert({
      club_id: clubId,
      member_id: input.memberId,
      amount: input.amount,
      category: input.category,
      occurred_at: toOccurredAt(input.occurredOn),
      note: input.note,
      recorded_by: recordedBy,
    })
    .select("id")
    .single();
  if (error) throw error;

  return { id: data.id };
}

// .select().single() after the write turns a row RLS silently excluded
// (another club's entry) into an error instead of a quiet no-op.
export async function updateRevenueEntry(
  id: string,
  input: RevenueEntryInput
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("revenue_entries")
    .update({
      member_id: input.memberId,
      amount: input.amount,
      category: input.category,
      occurred_at: toOccurredAt(input.occurredOn),
      note: input.note,
    })
    .eq("id", id)
    .select("id")
    .single();
  if (error) throw error;
}

export async function deleteRevenueEntry(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("revenue_entries")
    .delete()
    .eq("id", id)
    .select("id")
    .single();
  if (error) throw error;
}

/**
 * Every number the revenue cards show, from a single 12-month fetch — the
 * current/previous month, the rolling year, the sparkline buckets and the
 * paying-member count all live inside that same window.
 */
export async function getClubRevenueSummary(
  clubId: string
): Promise<ClubRevenueSummary> {
  const supabase = createClient();

  const now = new Date();
  const windowStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const { data, error } = await supabase
    .from("revenue_entries")
    .select("amount, occurred_at, member_id")
    .eq("club_id", clubId)
    .gte("occurred_at", windowStart.toISOString());
  if (error) throw error;

  const rows = data ?? [];
  const currentKey = monthKey(now);
  const previousKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  let currentMonth = 0;
  let previousMonth = 0;
  let lastTwelveMonths = 0;
  let entriesThisMonth = 0;
  const payingMembers = new Set<string>();
  const weeklySeries: number[] = new Array(5).fill(0);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const row of rows) {
    const amount = Number(row.amount);
    const occurred = new Date(row.occurred_at);
    const key = monthKey(occurred);

    lastTwelveMonths += amount;
    if (key === currentKey) {
      currentMonth += amount;
      entriesThisMonth += 1;
      if (row.member_id) payingMembers.add(row.member_id);
    }
    if (key === previousKey) previousMonth += amount;

    const daysAgo = Math.floor(
      (today.getTime() - parseIsoDate(toIsoDate(occurred)).getTime()) / 86_400_000
    );
    // An entry dated ahead (a fee taken in advance) still belongs in the
    // newest bucket rather than off the end of the array.
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
    payingMembersThisMonth: payingMembers.size,
    entriesThisMonth,
  };
}
