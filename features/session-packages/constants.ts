import type { SessionPackageStatus, SessionStatus } from "./types/session-package-types";

export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  unscheduled: "برنامه‌ریزی‌نشده",
  scheduled: "برنامه‌ریزی‌شده",
  done: "برگزارشده",
  canceled: "لغوشده",
};

export const SESSION_STATUS_VARIANT = {
  unscheduled: "secondary",
  scheduled: "warning",
  done: "success",
  canceled: "outline",
} as const;

export const PACKAGE_STATUS_LABEL: Record<SessionPackageStatus, string> = {
  pending_payment: "در انتظار پرداخت",
  active: "فعال",
  completed: "تکمیل‌شده",
  cancelled: "لغو‌شده",
};

export const PACKAGE_STATUS_VARIANT = {
  pending_payment: "warning",
  active: "success",
  completed: "secondary",
  cancelled: "outline",
} as const;

/** Mirrors the API's bound; a bigger package is almost certainly a typo. */
export const MAX_PACKAGE_SESSIONS = 100;
