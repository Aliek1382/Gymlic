import type { RevenueCategory } from "../types/revenue-types";

export const REVENUE_CATEGORY_LABEL: Record<RevenueCategory, string> = {
  membership: "شهریه عضویت",
  session: "جلسه / کلاس تکی",
  product: "فروش کالا",
  other: "سایر",
};

export const REVENUE_CATEGORY_VALUES = [
  "membership",
  "session",
  "product",
  "other",
] as const satisfies readonly RevenueCategory[];

/** Radix Select has no empty value, so "no member attached" needs one. */
export const NO_MEMBER_VALUE = "none";
