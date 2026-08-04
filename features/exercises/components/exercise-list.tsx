"use client";

import { useMemo } from "react";
import { Dumbbell } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/features/dashboard/components/shared/empty-state";
import { TableCardSkeleton } from "@/features/dashboard/components/shared/dashboard-skeleton";
import { useExercises } from "../hooks/use-exercises";
import type { ExerciseSummary } from "../types/exercise-types";

function groupByMuscle(exercises: ExerciseSummary[]) {
  const groups = new Map<string, ExerciseSummary[]>();
  for (const exercise of exercises) {
    const list = groups.get(exercise.muscleGroup) ?? [];
    list.push(exercise);
    groups.set(exercise.muscleGroup, list);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, "fa"));
}

export function ExerciseList() {
  const exercises = useExercises();

  const groups = useMemo(
    () => groupByMuscle(exercises.data ?? []),
    [exercises.data]
  );

  if (exercises.isLoading) {
    return <TableCardSkeleton />;
  }

  if (exercises.isError) {
    return (
      <Card className="border-destructive/30 py-5">
        <p className="px-6 text-sm text-destructive">
          دریافت کتابخانه حرکات با خطا مواجه شد. صفحه را دوباره بارگذاری کنید.
        </p>
      </Card>
    );
  }

  if (groups.length === 0) {
    return (
      <Card className="py-5">
        <EmptyState
          icon={Dumbbell}
          title="هنوز حرکتی ثبت نشده است."
          description="با دکمه «افزودن حرکت جدید» اولین حرکت خود را ثبت کنید."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(([muscleGroup, items]) => (
        <Card key={muscleGroup} className="gap-4 py-5">
          <div className="px-6">
            <CardTitle className="text-base">{muscleGroup}</CardTitle>
          </div>
          <div className="grid grid-cols-1 gap-2 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
            {items.map((exercise) => (
              <div
                key={exercise.id}
                className="flex flex-col gap-2 rounded-xl border border-border p-3"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">
                    {exercise.name}
                  </p>
                  {exercise.nameEn && (
                    <p dir="ltr" className="text-xs text-muted-foreground">
                      {exercise.nameEn}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary">{exercise.muscleGroup}</Badge>
                  {exercise.isCustom && (
                    <Badge variant="info">حرکت شما</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
