"use client";

import { Minus, Ruler, TrendingDown, TrendingUp } from "lucide-react";

import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatPersianDate, toPersianDigits } from "@/lib/persian";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { MeasurementFormDialog } from "./measurement-form-dialog";
import { buildEntryDeltas, type EntryDeltas, type MetricDelta } from "../utils/deltas";
import type { MeasurementEntry } from "../types/progress-types";

function metricLine(entry: MeasurementEntry): string {
  const parts: string[] = [];
  if (entry.weightKg !== null) parts.push(`وزن: ${toPersianDigits(entry.weightKg)} کیلوگرم`);
  if (entry.heightCm !== null) parts.push(`قد: ${toPersianDigits(entry.heightCm)} سانتی‌متر`);
  if (entry.bodyFatPercent !== null) parts.push(`چربی: ${toPersianDigits(entry.bodyFatPercent)}٪`);
  if (entry.waistCm !== null) parts.push(`دور کمر: ${toPersianDigits(entry.waistCm)} سانتی‌متر`);
  if (entry.chestCm !== null) parts.push(`دور سینه: ${toPersianDigits(entry.chestCm)} سانتی‌متر`);
  return parts.join(" · ");
}

const DELTA_METRIC_LABELS: Record<keyof EntryDeltas, string> = {
  weightKg: "وزن",
  bodyFatPercent: "چربی",
  waistCm: "دور کمر",
  chestCm: "دور سینه",
};

const DELTA_ICON: Record<MetricDelta["direction"], typeof TrendingUp> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
};

function DeltaBadges({ deltas }: { deltas: EntryDeltas }) {
  const rows = (Object.keys(deltas) as (keyof EntryDeltas)[]).filter(
    (key) => deltas[key] !== undefined
  );
  if (rows.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {rows.map((key) => {
        const delta = deltas[key] as MetricDelta;
        const Icon = DELTA_ICON[delta.direction];
        return (
          <span
            key={key}
            className={cn(
              "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground",
              delta.direction !== "flat" && "text-foreground"
            )}
          >
            <Icon className="size-3" />
            {DELTA_METRIC_LABELS[key]} {delta.label}
          </span>
        );
      })}
    </div>
  );
}

export function MeasurementLog({
  athleteId,
  entries,
  currentUserId,
  recorderLabel,
}: {
  athleteId: string;
  entries: MeasurementEntry[];
  currentUserId: string | undefined;
  // Maps a recorder's id to a display label ("شما" / "مربی" / "ورزشکار").
  recorderLabel: (recordedBy: string | null) => string;
}) {
  const entryDeltas = buildEntryDeltas(entries);
  const descending = [...entries].reverse();

  return (
    <Card className="gap-4 py-5">
      <div className="px-6">
        <CardTitle className="text-base">تاریخچه‌ی اندازه‌گیری‌ها</CardTitle>
      </div>
      <div className="space-y-2 px-6">
        {descending.length === 0 ? (
          <EmptyState
            icon={Ruler}
            title="هنوز اندازه‌گیری‌ای ثبت نشده است."
            description="با دکمه «ثبت اندازه‌گیری جدید» اولین مقدار را وارد کنید."
          />
        ) : (
          descending.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-foreground">
                    {formatPersianDate(new Date(entry.recordedAt))}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ثبت‌شده توسط {recorderLabel(entry.recordedBy)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{metricLine(entry)}</p>
                <DeltaBadges deltas={entryDeltas[entry.id] ?? {}} />
                {entry.note && (
                  <p className="text-xs text-muted-foreground">{entry.note}</p>
                )}
              </div>
              {entry.recordedBy === currentUserId && (
                <MeasurementFormDialog athleteId={athleteId} entry={entry} />
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
