import type { MembershipStatus } from "@/types/database.types";

export const TRAINER_INVITE_EXPIRES_DAYS = 30;

export const TRAINER_STATUS_LABEL: Record<MembershipStatus, string> = {
  active: "فعال",
  pending: "در انتظار",
  suspended: "معلق",
};

export const TRAINER_STATUS_VALUES = [
  "active",
  "pending",
  "suspended",
] as const satisfies readonly MembershipStatus[];

export const TRAINER_STATUS_VARIANT: Record<
  MembershipStatus,
  "success" | "warning" | "secondary"
> = {
  active: "success",
  pending: "warning",
  suspended: "secondary",
};

export type TrainerSortOrder = "newest" | "oldest" | "name" | "most-athletes";

export const TRAINER_SORT_LABEL: Record<TrainerSortOrder, string> = {
  newest: "جدیدترین همکاری",
  oldest: "قدیمی‌ترین همکاری",
  name: "بر اساس نام",
  "most-athletes": "بیشترین شاگرد",
};

/** Radix Select has no empty value, so "no filter" needs one of its own. */
export const ALL_FILTER_VALUE = "all";
