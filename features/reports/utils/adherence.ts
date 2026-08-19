import type { AthleteWeeklyAdherence } from "../types/report-types";

// Whoever is furthest behind is who the trainer needs to reach out to, so
// they sort to the top. An athlete with no active plan isn't behind on
// anything — they'd otherwise rank as 0% and crowd out real cases — so they
// sort last regardless of the ratio.
export function byNeedsAttention(
  a: AthleteWeeklyAdherence,
  b: AthleteWeeklyAdherence
): number {
  if (a.sessionsPerWeek === 0 || b.sessionsPerWeek === 0) {
    if (a.sessionsPerWeek === b.sessionsPerWeek) return 0;
    return a.sessionsPerWeek === 0 ? 1 : -1;
  }
  return a.doneThisWeek / a.sessionsPerWeek - b.doneThisWeek / b.sessionsPerWeek;
}
