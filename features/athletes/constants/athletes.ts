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
