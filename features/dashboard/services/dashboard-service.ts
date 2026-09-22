import { api, fullName } from "@/lib/api/client";
import { getPersianMonthLabel } from "@/lib/persian";
import { parseIsoDate, toIsoDate } from "@/lib/iso-date";
import { SUBSCRIPTION_WARNING_DAYS } from "../constants/dashboard";
import { trendFromChange } from "../utils/trend";
import type {
  ClubDashboardData,
  ClubStatistics,
  MemberDistribution,
  RecentActivityItem,
  RevenuePoint,
  SubscriptionInfo,
} from "../types/dashboard-types";

const NO_PLAN_LABEL = "بدون طرح";

// Cycled through in plan order; the last one is the muted slot the
// "no plan" segment always takes.
const PLAN_COLORS = [
  "var(--chart-1)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-2)",
];
const NO_PLAN_COLOR = "var(--border)";

interface ClubDashboardResponse {
  club_name: string;
  statistics: {
    member_count: number;
    members_this_month: number;
    members_last_month: number;
    trainer_count: number;
    trainers_this_month: number;
    trainers_last_month: number;
    revenue_this_month: number;
    revenue_last_month: number;
    member_capacity: number | null;
    attendance_this_month: number;
    attendance_last_month: number;
    revenue_sparkline: number[];
  };
  revenue_series: { month: string; total: number }[];
  plan_distribution: { plan_name: string; member_count: number }[];
  subscription: { plan_name: string; status: string; expires_at: string } | null;
  recent_members: {
    id: string;
    user_id: string;
    status: string;
    joined_at: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    plan_name: string | null;
  }[];
  trainers: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  }[];
}

/**
 * The whole club dashboard in one request. This was 8-13 parallel queries
 * from the browser; the API assembles it server-side instead.
 */
export async function getClubDashboard(
  clubId: string,
  revenueMonths = 6
): Promise<ClubDashboardData> {
  const data = await api.get<ClubDashboardResponse>(`/dashboard/club/${clubId}`);

  return {
    clubName: data.club_name,
    statistics: toStatistics(data),
    memberDistribution: toMemberDistribution(data),
    revenueSeries: toRevenueSeries(data, revenueMonths),
    recentActivities: toRecentActivities(data),
    subscription: toSubscription(data),
  };
}

function toStatistics(data: ClubDashboardResponse): ClubStatistics {
  const stats = data.statistics;

  return {
    classAttendancePercent: stats.attendance_this_month,
    classAttendanceTrend: trendFromChange(
      stats.attendance_this_month,
      stats.attendance_last_month
    ),
    monthlyRevenue: stats.revenue_this_month,
    monthlyRevenueTrend: trendFromChange(
      stats.revenue_this_month,
      stats.revenue_last_month
    ),
    monthlyRevenueSeries: stats.revenue_sparkline,
    activeTrainersCount: stats.trainer_count,
    activeTrainersTrend: trendFromChange(
      stats.trainers_this_month,
      stats.trainers_last_month
    ),
    trainerAvatars: data.trainers.map((row) => ({
      id: row.id,
      name: fullName(row.first_name, row.last_name, ""),
      avatarUrl: row.avatar_url,
    })),
    totalMembersCount: stats.member_count,
    totalMembersTrend: trendFromChange(
      stats.members_this_month,
      stats.members_last_month
    ),
    totalMembersTarget: stats.member_capacity ?? stats.member_count,
  };
}

function toMemberDistribution(data: ClubDashboardResponse): MemberDistribution {
  const total = data.plan_distribution.reduce((sum, row) => sum + row.member_count, 0);

  const segments = data.plan_distribution.map((row, index) => ({
    label: row.plan_name,
    percent: total === 0 ? 0 : Math.round((row.member_count / total) * 100),
    color:
      row.plan_name === NO_PLAN_LABEL
        ? NO_PLAN_COLOR
        : PLAN_COLORS[index % PLAN_COLORS.length],
  }));

  return { totalActive: total, segments };
}

function toRevenueSeries(
  data: ClubDashboardResponse,
  months: number
): RevenuePoint[] {
  const totals = new Map(data.revenue_series.map((row) => [row.month, row.total]));
  const now = new Date();
  const points: RevenuePoint[] = [];

  for (let i = months - 1; i >= 0; i -= 1) {
    const bucketDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    points.push({
      label: getPersianMonthLabel(bucketDate),
      value: totals.get(toIsoDate(bucketDate).slice(0, 7)) ?? 0,
    });
  }

  return points;
}

function toRecentActivities(data: ClubDashboardResponse): RecentActivityItem[] {
  return data.recent_members.map((row) => {
    const name = fullName(row.first_name, row.last_name);
    return {
      id: row.id,
      memberName: name,
      memberEmail: row.phone ?? "",
      memberInitials: (name || "کا").trim().slice(0, 2),
      planName: row.plan_name ?? NO_PLAN_LABEL,
      status:
        row.status === "active"
          ? "active"
          : row.status === "pending"
            ? "pending"
            : "cancelled",
      date: row.joined_at,
    };
  });
}

function toSubscription(data: ClubDashboardResponse): SubscriptionInfo | null {
  if (!data.subscription) return null;

  const remainingDays = Math.ceil(
    (parseIsoDate(data.subscription.expires_at.slice(0, 10)).getTime() - Date.now()) /
      (1000 * 60 * 60 * 24)
  );

  const status =
    remainingDays < 0
      ? "expired"
      : remainingDays <= SUBSCRIPTION_WARNING_DAYS
        ? "expiring"
        : "active";

  return {
    planName: data.subscription.plan_name,
    status,
    expiresAt: data.subscription.expires_at,
    remainingDays: Math.max(0, remainingDays),
  };
}
