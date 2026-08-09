import type { MeasurementEntry } from "../types/progress-types";

export function calculateBmi(
  weightKg: number | null,
  heightCm: number | null
): number | null {
  if (!weightKg || !heightCm) return null;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

// `entries` must be oldest-first. Height rarely changes after adolescence,
// so a trainer/athlete only needs to enter it once — every later entry can
// reuse whatever was last recorded instead of re-typing it.
export function getLatestKnownHeight(entries: MeasurementEntry[]): number | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].heightCm !== null) return entries[i].heightCm;
  }
  return null;
}
