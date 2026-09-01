import type { MembershipPlanTier, MembershipStatus } from "@/types/database.types";

export const MEMBER_INVITE_EXPIRES_DAYS = 30;

export const PLAN_TIER_LABEL: Record<MembershipPlanTier, string> = {
  elite: "ویژه (Elite)",
  basic: "پایه",
  daily: "روزانه",
};

export const PLAN_TIER_VALUES = ["elite", "basic", "daily"] as const satisfies
  readonly MembershipPlanTier[];

export const MEMBER_STATUS_LABEL: Record<MembershipStatus, string> = {
  active: "فعال",
  pending: "در انتظار",
  suspended: "معلق",
};

export const MEMBER_STATUS_VALUES = [
  "active",
  "pending",
  "suspended",
] as const satisfies readonly MembershipStatus[];

export const MEMBER_STATUS_VARIANT: Record<
  MembershipStatus,
  "success" | "warning" | "secondary"
> = {
  active: "success",
  pending: "warning",
  suspended: "secondary",
};

export type MemberSortOrder = "newest" | "oldest" | "name";

export const MEMBER_SORT_LABEL: Record<MemberSortOrder, string> = {
  newest: "جدیدترین عضویت",
  oldest: "قدیمی‌ترین عضویت",
  name: "بر اساس نام",
};

/** Value used by the status/plan dropdowns for "no filter" — Radix Select has no empty value. */
export const ALL_FILTER_VALUE = "all";
