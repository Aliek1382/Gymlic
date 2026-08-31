import type { PlanKind } from "../types/athlete-types";

export const INVITE_EXPIRES_DAYS = 30;

export type AthleteSortOrder =
  | "newest"
  | "oldest"
  | "most-workout"
  | "fewest-workout"
  | "most-nutrition"
  | "fewest-nutrition";

export const ATHLETE_SORT_LABEL: Record<AthleteSortOrder, string> = {
  newest: "جدیدترین به قدیمی‌ترین",
  oldest: "قدیمی‌ترین به جدیدترین",
  "most-workout": "بیشترین برنامه تمرینی",
  "fewest-workout": "کمترین برنامه تمرینی",
  "most-nutrition": "بیشترین برنامه غذایی",
  "fewest-nutrition": "کمترین برنامه غذایی",
};

// Placeholder for the free-text description box, which every plan-writing
// surface (assign, edit, template) shares.
export const PLAN_DESCRIPTION_PLACEHOLDER: Record<PlanKind, string> = {
  workout: "توضیحات آزاد برای شرح حرکات، ست و تکرار...",
  nutrition: "توضیحات آزاد برای شرح وعده‌های غذایی، مقدار و واحد...",
};
