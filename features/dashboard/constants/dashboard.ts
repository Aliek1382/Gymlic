export const MAX_RECENT_ACTIVITIES = 10;
export const SUBSCRIPTION_WARNING_DAYS = 7;

export const REVENUE_RANGE_OPTIONS = [
  { value: "3", label: "۳ ماه گذشته" },
  { value: "6", label: "۶ ماه گذشته" },
  { value: "12", label: "۱۲ ماه گذشته" },
] as const;

export const ACTIVITY_STATUS_LABEL: Record<string, string> = {
  active: "فعال",
  pending: "در انتظار",
  cancelled: "منقضی شده",
};
