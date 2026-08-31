import type { StatTrend } from "../types/dashboard-types";

/**
 * Turns a current-vs-previous pair into the badge a StatisticCard shows.
 * Shared by the club dashboard and the trainer earnings cards so both read
 * the same way — a "پایدار" badge means the same thing on either.
 */
export function trendFromChange(current: number, previous: number): StatTrend {
  if (previous <= 0) {
    return current > 0
      ? { direction: "up", label: "+۱۰۰٪" }
      : { direction: "flat", label: "پایدار" };
  }
  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 1) return { direction: "flat", label: "پایدار" };
  const direction = change > 0 ? "up" : "down";
  const sign = change > 0 ? "+" : "";
  return { direction, label: `${sign}${Math.round(change)}٪` };
}
