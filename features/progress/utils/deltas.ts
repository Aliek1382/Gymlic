import { toPersianDigits } from "@/lib/persian";
import type { MeasurementEntry } from "../types/progress-types";

export type TrendDirection = "up" | "down" | "flat";

export interface MetricDelta {
  direction: TrendDirection;
  label: string;
}

const DELTA_METRICS = ["weightKg", "bodyFatPercent", "waistCm", "chestCm"] as const;
export type DeltaMetricKey = (typeof DELTA_METRICS)[number];

export type EntryDeltas = Partial<Record<DeltaMetricKey, MetricDelta>>;

export function deltaFor(current: number, previous: number): MetricDelta {
  const diff = Math.round((current - previous) * 10) / 10;
  if (diff === 0) return { direction: "flat", label: "بدون تغییر" };
  const direction = diff > 0 ? "up" : "down";
  const sign = diff > 0 ? "+" : "";
  return { direction, label: `${sign}${toPersianDigits(diff)}` };
}

// `entries` must be oldest-first. Returns, for every entry, the change in
// each metric versus the nearest *earlier* entry that also recorded it —
// not necessarily the immediately preceding entry, since a given field
// isn't always filled in every time.
export function buildEntryDeltas(
  entries: MeasurementEntry[]
): Record<string, EntryDeltas> {
  const result: Record<string, EntryDeltas> = {};
  const lastSeen: Partial<Record<DeltaMetricKey, number>> = {};

  for (const entry of entries) {
    const deltas: EntryDeltas = {};
    for (const key of DELTA_METRICS) {
      const value = entry[key];
      if (value !== null) {
        const previous = lastSeen[key];
        if (previous !== undefined) {
          deltas[key] = deltaFor(value, previous);
        }
        lastSeen[key] = value;
      }
    }
    result[entry.id] = deltas;
  }

  return result;
}
