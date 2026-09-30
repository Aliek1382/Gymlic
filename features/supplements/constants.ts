import type { SupplementPlanStatus, SupplementTiming } from "./types/supplement-types";

export const TIMING_OPTIONS: { value: SupplementTiming; label: string }[] = [
  { value: "before_workout", label: "قبل از تمرین" },
  { value: "after_workout", label: "بعد از تمرین" },
  { value: "breakfast", label: "صبحانه" },
  { value: "lunch", label: "ناهار" },
  { value: "dinner", label: "شام" },
  { value: "before_sleep", label: "قبل از خواب" },
  { value: "custom", label: "ساعت دلخواه" },
];

export const TIMING_LABEL = Object.fromEntries(
  TIMING_OPTIONS.map((option) => [option.value, option.label])
) as Record<SupplementTiming, string>;

/** Mirrors SupplementController::FIXED_TIMES: when the reminder for a meal-based timing fires. */
export const FIXED_REMINDER_TIME: Partial<Record<SupplementTiming, string>> = {
  breakfast: "08:00",
  lunch: "13:00",
  dinner: "20:00",
  before_sleep: "22:30",
};

export const PLAN_STATUS_LABEL: Record<SupplementPlanStatus, string> = {
  active: "فعال",
  completed: "تکمیل‌شده",
  cancelled: "لغوشده",
};

export const PLAN_STATUS_VARIANT = {
  active: "success",
  completed: "secondary",
  cancelled: "outline",
} as const;

/** Mirrors the API's bound on a plan's length. */
export const MAX_PLAN_ITEMS = 30;
