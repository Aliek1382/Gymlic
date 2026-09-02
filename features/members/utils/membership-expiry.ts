import { parseIsoDate, todayIso } from "@/lib/iso-date";

/** A membership within this many days of its end date counts as expiring. */
export const EXPIRING_SOON_DAYS = 7;

export type ExpiryState = "none" | "active" | "expiring" | "expired";

/**
 * Whole days from today to the membership's end date — negative once it has
 * passed. Both sides are calendar days in the viewer's own zone, so a
 * membership ending today reads as 0 rather than as a fraction.
 */
export function daysUntilExpiry(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const end = parseIsoDate(expiresAt).getTime();
  const today = parseIsoDate(todayIso()).getTime();
  return Math.round((end - today) / 86_400_000);
}

export function expiryState(expiresAt: string | null): ExpiryState {
  const days = daysUntilExpiry(expiresAt);
  if (days === null) return "none";
  if (days < 0) return "expired";
  if (days <= EXPIRING_SOON_DAYS) return "expiring";
  return "active";
}
