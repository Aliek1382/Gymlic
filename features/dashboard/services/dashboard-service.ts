import { createClient } from "@/lib/supabase/client";
import { getPersianMonthLabel } from "@/lib/persian";
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

const PLAN_TIER_LABEL: Record<string, string> = {
  elite: "ویژه (Elite)",
  basic: "پایه",
  daily: "روزانه",
};

const PLAN_TIER_COLOR: Record<string, string> = {
  elite: "var(--chart-1)",
  basic: "var(--chart-2)",
  daily: "var(--border)",
};

/** Finds the club the current user manages/works at (their first active membership). */
export async function getActiveClubId(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("memberships")
    .select("club_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.club_id ?? null;
}

export async function getClubName(clubId: string): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("clubs")
    .select("name")
    .eq("id", clubId)
    .single();
  if (error) throw error;
  return data.name;
}

export async function getClubStatistics(
  clubId: string
): Promise<ClubStatistics> {
  const supabase = createClient();
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    membersThisMonth,
    membersLastMonth,
    totalMembers,
    trainersThisMonth,
    trainersLastMonth,
    totalTrainers,
    trainerRows,
    revenueThisMonth,
    revenueLastMonth,
    attendanceThisMonth,
    attendanceLastMonth,
    club,
    monthlyRevenueSeries,
  ] = await Promise.all([
    countMembers(clubId, "athlete", startOfThisMonth),
    countMembers(clubId, "athlete", startOfLastMonth, startOfThisMonth),
    countMembers(clubId, "athlete"),
    countMembers(clubId, "trainer", startOfThisMonth),
    countMembers(clubId, "trainer", startOfLastMonth, startOfThisMonth),
    countMembers(clubId, "trainer"),
    supabase
      .from("memberships")
      .select("user_id, profiles(first_name, last_name, avatar_url)")
      .eq("club_id", clubId)
      .eq("role", "trainer")
      .eq("status", "active")
      .limit(4)
      .returns<
        {
          user_id: string;
          profiles: {
            first_name: string | null;
            last_name: string | null;
            avatar_url: string | null;
          } | null;
        }[]
      >(),
    sumRevenue(clubId, startOfThisMonth),
    sumRevenue(clubId, startOfLastMonth, startOfThisMonth),
    attendanceRate(clubId, startOfThisMonth),
    attendanceRate(clubId, startOfLastMonth, startOfThisMonth),
    supabase.from("clubs").select("member_capacity").eq("id", clubId).single(),
    getRevenueSparkline(clubId),
  ]);

  return {
    classAttendancePercent: attendanceThisMonth,
    classAttendanceTrend: trendFromChange(attendanceThisMonth, attendanceLastMonth),
    monthlyRevenue: revenueThisMonth,
    monthlyRevenueTrend: trendFromChange(revenueThisMonth, revenueLastMonth),
    monthlyRevenueSeries,
    activeTrainersCount: totalTrainers,
    activeTrainersTrend: trendFromChange(trainersThisMonth, trainersLastMonth),
    trainerAvatars: (trainerRows.data ?? []).map((row) => {
      const profile = row.profiles;
      return {
        id: row.user_id,
        name: [profile?.first_name, profile?.last_name].filter(Boolean).join(" "),
        avatarUrl: profile?.avatar_url ?? null,
      };
    }),
    totalMembersCount: totalMembers,
    totalMembersTrend: trendFromChange(membersThisMonth, membersLastMonth),
    totalMembersTarget: club.data?.member_capacity ?? totalMembers,
  };
}

async function countMembers(
  clubId: string,
  role: "athlete" | "trainer",
  joinedAfter?: Date,
  joinedBefore?: Date
) {
  const supabase = createClient();
  let query = supabase
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId)
    .eq("role", role)
    .eq("status", "active");

  if (joinedAfter) query = query.gte("joined_at", joinedAfter.toISOString());
  if (joinedBefore) query = query.lt("joined_at", joinedBefore.toISOString());

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function sumRevenue(clubId: string, from: Date, to?: Date) {
  const supabase = createClient();
  let query = supabase
    .from("revenue_entries")
    .select("amount")
    .eq("club_id", clubId)
    .gte("occurred_at", from.toISOString());
  if (to) query = query.lt("occurred_at", to.toISOString());

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
}

async function attendanceRate(clubId: string, from: Date, to?: Date) {
  const supabase = createClient();
  let query = supabase
    .from("class_attendance_logs")
    .select("attended")
    .eq("club_id", clubId)
    .gte("class_date", from.toISOString().slice(0, 10));
  if (to) query = query.lt("class_date", to.toISOString().slice(0, 10));

  const { data, error } = await query;
  if (error) throw error;
  if (!data || data.length === 0) return 0;
  const attended = data.filter((row) => row.attended).length;
  return Math.round((attended / data.length) * 100);
}

async function getRevenueSparkline(clubId: string): Promise<number[]> {
  const supabase = createClient();
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 35);

  const { data, error } = await supabase
    .from("revenue_entries")
    .select("amount, occurred_at")
    .eq("club_id", clubId)
    .gte("occurred_at", start.toISOString());
  if (error) throw error;

  const buckets = new Array(5).fill(0);
  for (const row of data ?? []) {
    const daysAgo = Math.floor(
      (now.getTime() - new Date(row.occurred_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    const bucketIndex = Math.min(4, Math.floor(daysAgo / 7));
    buckets[4 - bucketIndex] += Number(row.amount);
  }
  return buckets;
}

export async function getMemberDistribution(
  clubId: string
): Promise<MemberDistribution> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("plan_tier")
    .eq("club_id", clubId)
    .eq("role", "athlete")
    .eq("status", "active");
  if (error) throw error;

  const rows = data ?? [];
  const total = rows.length;
  const counts: Record<string, number> = { elite: 0, basic: 0, daily: 0 };
  for (const row of rows) counts[row.plan_tier] = (counts[row.plan_tier] ?? 0) + 1;

  const segments = (["elite", "basic", "daily"] as const).map((tier) => ({
    label: PLAN_TIER_LABEL[tier],
    percent: total > 0 ? Math.round((counts[tier] / total) * 100) : 0,
    color: PLAN_TIER_COLOR[tier],
  }));

  return { totalActive: total, segments };
}

export async function getRevenueSeries(
  clubId: string,
  months = 6
): Promise<RevenuePoint[]> {
  const supabase = createClient();
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const { data, error } = await supabase
    .from("revenue_entries")
    .select("amount, occurred_at")
    .eq("club_id", clubId)
    .gte("occurred_at", start.toISOString());
  if (error) throw error;

  const points: RevenuePoint[] = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const bucketDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const nextBucketDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const value = (data ?? [])
      .filter((row) => {
        const t = new Date(row.occurred_at).getTime();
        return t >= bucketDate.getTime() && t < nextBucketDate.getTime();
      })
      .reduce((sum, row) => sum + Number(row.amount), 0);
    points.push({ label: getPersianMonthLabel(bucketDate), value });
  }

  // Newest month first so it renders on the right edge of the RTL chart.
  return points.reverse();
}

export async function getRecentActivities(
  clubId: string,
  limit = 10
): Promise<RecentActivityItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select(
      "id, plan_tier, status, joined_at, profiles(first_name, last_name, phone)"
    )
    .eq("club_id", clubId)
    .eq("role", "athlete")
    .order("joined_at", { ascending: false })
    .limit(limit)
    .returns<
      {
        id: string;
        plan_tier: string;
        status: string;
        joined_at: string;
        profiles: {
          first_name: string | null;
          last_name: string | null;
          phone: string | null;
        } | null;
      }[]
    >();
  if (error) throw error;

  return (data ?? []).map((row) => {
    const profile = row.profiles;
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
    return {
      id: row.id,
      memberName: name || "بدون نام",
      memberEmail: profile?.phone ?? "",
      memberInitials: (name || "کا").trim().slice(0, 2),
      planName: PLAN_TIER_LABEL[row.plan_tier] ?? row.plan_tier,
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

export async function getSubscription(
  clubId: string
): Promise<SubscriptionInfo | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("plan_name, status, expires_at")
    .eq("club_id", clubId)
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const remainingDays = Math.ceil(
    (new Date(data.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const status =
    remainingDays < 0
      ? "expired"
      : remainingDays <= SUBSCRIPTION_WARNING_DAYS
        ? "expiring"
        : "active";

  return {
    planName: data.plan_name,
    status,
    expiresAt: data.expires_at,
    remainingDays: Math.max(0, remainingDays),
  };
}

export async function getClubDashboard(
  clubId: string,
  revenueMonths = 6
): Promise<ClubDashboardData> {
  const [clubName, statistics, memberDistribution, revenueSeries, recentActivities, subscription] =
    await Promise.all([
      getClubName(clubId),
      getClubStatistics(clubId),
      getMemberDistribution(clubId),
      getRevenueSeries(clubId, revenueMonths),
      getRecentActivities(clubId),
      getSubscription(clubId),
    ]);

  return {
    clubName,
    statistics,
    memberDistribution,
    revenueSeries,
    recentActivities,
    subscription,
  };
}
