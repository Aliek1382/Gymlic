import type { StatTrend } from "@/features/dashboard/types/dashboard-types";
import type { RevenueCategory } from "@/types/database.types";

export type { RevenueCategory };

export interface RevenueEntry {
  id: string;
  memberId: string | null;
  memberName: string | null;
  amount: number;
  category: RevenueCategory;
  /** The day the money came in — "YYYY-MM-DD" in the club's own calendar. */
  occurredOn: string;
  note: string | null;
}

export interface RevenueEntryInput {
  memberId: string | null;
  amount: number;
  category: RevenueCategory;
  occurredOn: string;
  note: string | null;
}

export interface ClubRevenueSummary {
  currentMonth: number;
  previousMonth: number;
  currentMonthTrend: StatTrend;
  lastTwelveMonths: number;
  /** Five weekly buckets across the last 35 days, oldest first. */
  weeklySeries: number[];
  payingMembersThisMonth: number;
  entriesThisMonth: number;
}
