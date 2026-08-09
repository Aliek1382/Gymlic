import { formatShortPersianDate } from "@/lib/persian";
import { calculateBmi } from "./bmi";
import type { MeasurementEntry } from "../types/progress-types";

export type MetricKey = "weight" | "bmi" | "bodyFat" | "waist" | "chest";

export interface ChartPoint {
  label: string;
  weight: number | null;
  bmi: number | null;
  bodyFat: number | null;
  waist: number | null;
  chest: number | null;
}

export const METRICS: { key: MetricKey; title: string; unit: string; color: string }[] = [
  { key: "weight", title: "وزن", unit: "کیلوگرم", color: "var(--chart-1)" },
  { key: "bmi", title: "BMI", unit: "", color: "var(--chart-4)" },
  { key: "bodyFat", title: "درصد چربی بدن", unit: "٪", color: "var(--chart-3)" },
  { key: "waist", title: "دور کمر", unit: "سانتی‌متر", color: "var(--chart-5)" },
  { key: "chest", title: "دور سینه", unit: "سانتی‌متر", color: "var(--chart-2)" },
];

// entries must be oldest-first. Height is carried forward from whichever
// entry last recorded it, so BMI can be computed even on entries that only
// logged weight that day.
export function buildPoints(entries: MeasurementEntry[]): ChartPoint[] {
  let runningHeight: number | null = null;
  return entries.map((entry) => {
    if (entry.heightCm !== null) runningHeight = entry.heightCm;
    return {
      label: formatShortPersianDate(new Date(entry.recordedAt)),
      weight: entry.weightKg,
      bmi: calculateBmi(entry.weightKg, runningHeight),
      bodyFat: entry.bodyFatPercent,
      waist: entry.waistCm,
      chest: entry.chestCm,
    };
  });
}

export function seriesFor(points: ChartPoint[], key: MetricKey) {
  return points
    .filter((point) => point[key] !== null)
    .map((point) => ({ label: point.label, value: point[key] as number }));
}
