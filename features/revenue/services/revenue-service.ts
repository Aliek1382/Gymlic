import { api, fullName, type ListResponse } from "@/lib/api/client";
import { parseIsoDate, toIsoDate } from "@/lib/iso-date";
import { trendFromChange } from "@/features/dashboard/utils/trend";
import type {
  ClubRevenueSummary,
  RevenueCategory,
  RevenueEntry,
  RevenueEntryInput,
} from "../types/revenue-types";

const DELETED_MEMBER_LABEL = "عضو حذف‌شده";

interface RevenueRow {
  id: string;
  member_id: string | null;
  amount: number;
  category: RevenueCategory;
  // A calendar day, not a timestamp: the column is a DATE, so the old trick
  // of storing the picked day at local noon is no longer needed to keep an
  // entry from slipping into the neighbouring month.
  occurred_at: string;
  note: string | null;
  first_name: string | null;
  last_name: string | null;
}

/** "YYYY-MM" — the key every monthly bucket below groups on. */
function monthKey(date: Date): string {
  return toIsoDate(date).slice(0, 7);
}

function mapRow(row: RevenueRow): RevenueEntry {
  return {
    id: row.id,
    memberId: row.member_id,
    memberName: row.member_id
      ? fullName(row.first_name, row.last_name, DELETED_MEMBER_LABEL)
      : null,
    amount: row.amount,
    category: row.category,
    occurredOn: row.occurred_at,
    note: row.note,
  };
}

function toPayload(input: RevenueEntryInput) {
  return {
    member_id: input.memberId,
    amount: input.amount,
    category: input.category,
    occurred_at: input.occurredOn,
    note: input.note,
  };
}

async function listRows(clubId: string): Promise<RevenueRow[]> {
  const data = await api.get<ListResponse<RevenueRow>>(`/clubs/${clubId}/revenue`);
  return data.items;
}

/** Newest entry first — the order the ledger reads in. */
export async function listRevenueEntries(clubId: string): Promise<RevenueEntry[]> {
  return (await listRows(clubId)).map(mapRow);
}

export async function addRevenueEntry(
  clubId: string,
  input: RevenueEntryInput
): Promise<{ id: string }> {
  return api.post<{ id: string }>(`/clubs/${clubId}/revenue`, toPayload(input));
}

export async function updateRevenueEntry(
  id: string,
  input: RevenueEntryInput
): Promise<void> {
  await api.patch(`/revenue/${id}`, toPayload(input));
}

export async function deleteRevenueEntry(id: string): Promise<void> {
  await api.delete(`/revenue/${id}`);
}

/**
 * Every number the revenue cards show, from the ledger the page already
 * fetches — the current/previous month, the rolling year, the sparkline
 * buckets and the paying-member count all live inside that same window.
 */
export async function getClubRevenueSummary(
  clubId: string
): Promise<ClubRevenueSummary> {
  const now = new Date();
  const windowStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const rows = (await listRows(clubId)).filter(
    (row) => parseIsoDate(row.occurred_at) >= windowStart
  );

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
    const amount = row.amount;
    const occurred = parseIsoDate(row.occurred_at);
    const key = monthKey(occurred);

    lastTwelveMonths += amount;
    if (key === currentKey) {
      currentMonth += amount;
      entriesThisMonth += 1;
      if (row.member_id) payingMembers.add(row.member_id);
    }
    if (key === previousKey) previousMonth += amount;

    const daysAgo = Math.floor((today.getTime() - occurred.getTime()) / 86_400_000);
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
