import { api, query } from "@/lib/api/client";

type RoleCounts = { club: number; trainer: number; athlete: number; none: number };

export interface StatsInactiveUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  last_seen_at: string;
  /** Trainers: active athletes. */
  athletes: number | null;
  /** Club owners: their (first) club. */
  club_id: string | null;
  club_name: string | null;
}

export interface StatsSubscription {
  club_id: string;
  club_name: string;
  plan_name: string;
  expires_at: string;
  owner_name: string | null;
  owner_phone: string | null;
  days_left: number;
}

export interface StatsUsage {
  key: string;
  label: string;
  /** The section switch it belongs to, if it has one. */
  feature: string | null;
  enabled: boolean;
  /** Last 30 days. */
  actions: number;
  actors: number;
  /** The 30 days before. */
  prev_actions: number;
  prev_actors: number;
}

export interface AdminStats {
  today: string;
  totals: RoleCounts & { all: number };
  signups: {
    daily: (RoleCounts & { date: string })[];
    /** Weeks start on Saturday; `start` is that Saturday. */
    weekly: (RoleCounts & { start: string })[];
    this_week: number;
    last_week: number;
  };
  active: {
    /** daily_active once phase 9's SQL has run; until then only the headline counts. */
    source: "daily_active" | "last_seen" | "none";
    today: number;
    week: number;
    month: number;
    daily: { date: string; count: number }[];
    weekly: { start: string; count: number }[];
  };
  inactive: {
    days: number;
    trainers: { count: number; items: StatsInactiveUser[] };
    clubs: { count: number; items: StatsInactiveUser[] };
  };
  /** Null without the finance permission. */
  subscriptions: {
    expiring_days: number;
    expiring: StatsSubscription[];
    expired: StatsSubscription[];
  } | null;
  usage: StatsUsage[];
}

export function getAdminStats(inactiveDays: number) {
  return api.get<AdminStats>(`/admin/stats${query({ inactive_days: inactiveDays })}`);
}
