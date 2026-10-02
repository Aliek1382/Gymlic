import type { LucideIcon } from "lucide-react";

export type TrendDirection = "up" | "down" | "flat";

export interface StatTrend {
  direction: TrendDirection;
  label: string;
}

export interface ClubStatistics {
  classAttendancePercent: number;
  classAttendanceTrend: StatTrend;
  monthlyRevenue: number;
  monthlyRevenueTrend: StatTrend;
  monthlyRevenueSeries: number[];
  activeTrainersCount: number;
  activeTrainersTrend: StatTrend;
  trainerAvatars: { id: string; name: string; avatarUrl: string | null }[];
  totalMembersCount: number;
  totalMembersTrend: StatTrend;
  totalMembersTarget: number;
}

export interface MemberDistributionSegment {
  label: string;
  percent: number;
  color: string;
}

export interface MemberDistribution {
  totalActive: number;
  segments: MemberDistributionSegment[];
}

export interface RevenuePoint {
  label: string;
  value: number;
}

export type ActivityStatus = "active" | "pending" | "cancelled";

export interface RecentActivityItem {
  id: string;
  memberName: string;
  memberEmail: string;
  memberInitials: string;
  planName: string;
  status: ActivityStatus;
  date: string;
}

export interface SubscriptionInfo {
  planName: string;
  status: "active" | "expiring" | "grace" | "expired";
  expiresAt: string;
  remainingDays: number;
}

export interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface ClubDashboardData {
  clubName: string;
  statistics: ClubStatistics;
  memberDistribution: MemberDistribution;
  revenueSeries: RevenuePoint[];
  recentActivities: RecentActivityItem[];
  subscription: SubscriptionInfo | null;
}

// ---------------------------------------------------------------------------
// Trainer Dashboard
// ---------------------------------------------------------------------------

export interface TrainerStatistics {
  athletesCount: number;
  activeWorkoutProgramsCount: number;
  completedProgramsCount: number;
  activeNutritionPlansCount: number;
}

export type TrainerActivityType = "workout" | "nutrition";

export interface TrainerActivityItem {
  id: string;
  athleteName: string;
  title: string;
  description: string | null;
  type: TrainerActivityType;
  status: ActivityStatus;
  date: string;
}

/** An athlete's birthday in the coming week (Jalali month and day). */
export interface UpcomingBirthday {
  athleteId: string;
  name: string;
  /** "YYYY-MM-DD" of the day it falls on. */
  date: string;
  /** 0 = today. */
  daysLeft: number;
  /** The age reached on that day. */
  age: number;
}

export interface TrainerDraftPlan {
  id: string;
  athleteName: string;
  title: string;
  description: string | null;
  type: TrainerActivityType;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Athlete Dashboard
// ---------------------------------------------------------------------------

export interface AthletePlanSummary {
  id: string;
  title: string;
  description: string | null;
  assignedAt: string;
  // Only meaningfully "structured" for the workout card; the nutrition card
  // always reads "text" since nutrition plans never gained the builder.
  builderMode: "text" | "structured";
  // A pending invoice withholds the plan's content; only the amount is sent.
  invoice: { id: string; number: string; amountToman: number } | null;
}

export interface AthleteDashboardData {
  todaysWorkout: AthletePlanSummary | null;
  nutritionPlan: AthletePlanSummary | null;
  /** Trainers whose ended plan has put this athlete on hold. */
  suspendedTrainers: string[];
}
