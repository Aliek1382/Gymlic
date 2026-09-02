import type { MembershipStatus } from "@/types/database.types";

export const MEMBER_INVITE_EXPIRES_DAYS = 30;

/** Shown wherever a membership has no plan attached (a deleted plan, or an
 *  older membership from before the club defined its own plans). */
export const NO_PLAN_LABEL = "بدون طرح";

/** Radix Select has no empty value, so "no plan" needs one of its own. */
export const NO_PLAN_VALUE = "none";

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
