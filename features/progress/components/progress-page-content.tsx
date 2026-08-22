"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/features/authentication";
import { TrainingCalendar } from "@/features/athletes";
import { useMeasurements } from "../hooks/use-measurements";
import { getLatestKnownHeight } from "../utils/bmi";
import { MeasurementFormDialog } from "./measurement-form-dialog";
import { MeasurementLog } from "./measurement-log";
import { ProgressCharts } from "./progress-charts";

function recorderLabel(
  recordedBy: string | null,
  currentUserId: string | undefined,
  athleteId: string
): string {
  if (!recordedBy) return "نامشخص";
  if (recordedBy === currentUserId) return "شما";
  if (recordedBy === athleteId) return "ورزشکار";
  return "مربی";
}

export function ProgressPageContent({ athleteId }: { athleteId: string }) {
  const profile = useProfile();
  const measurements = useMeasurements(athleteId);

  if (measurements.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (measurements.isError || !measurements.data) {
    return (
      <Card className="border-destructive/30 py-5">
        <p className="px-6 text-sm text-destructive">
          دریافت اندازه‌گیری‌ها با خطا مواجه شد. صفحه را دوباره بارگذاری کنید.
        </p>
      </Card>
    );
  }

  const entries = measurements.data;
  const latestKnownHeight = getLatestKnownHeight(entries);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <MeasurementFormDialog
          athleteId={athleteId}
          latestKnownHeight={latestKnownHeight}
        />
      </div>

      <ProgressCharts entries={entries} />

      <TrainingCalendar athleteId={athleteId} />

      <MeasurementLog
        athleteId={athleteId}
        entries={entries}
        currentUserId={profile.data?.id}
        recorderLabel={(recordedBy) =>
          recorderLabel(recordedBy, profile.data?.id, athleteId)
        }
      />
    </div>
  );
}
