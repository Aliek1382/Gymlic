"use client";

import { useMemo, useState } from "react";
import { Dumbbell, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

function matchesQuery(exercise: ExerciseSummary, query: string): boolean {
  const q = query.toLowerCase();
  return (
    exercise.name.toLowerCase().includes(q) ||
    (exercise.nameEn ?? "").toLowerCase().includes(q) ||
    exercise.muscleGroup.toLowerCase().includes(q)
  );
}

export function ExerciseList() {
  const exercises = useExercises();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim();
    const data = exercises.data ?? [];
    return query ? data.filter((exercise) => matchesQuery(exercise, query)) : data;
  }, [exercises.data, search]);

  const groups = useMemo(() => groupByMuscle(filtered), [filtered]);

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

  if ((exercises.data?.length ?? 0) === 0) {
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
      <div className="relative">
        <Search className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="جستجوی نام حرکت (فارسی یا انگلیسی) یا گروه عضلانی..."
          className="pr-10"
        />
      </div>

      {groups.length === 0 ? (
        <Card className="py-5">
          <EmptyState
            icon={Search}
            title="نتیجه‌ای پیدا نشد."
            description="حرکتی با این نام یا گروه عضلانی پیدا نشد."
          />
        </Card>
      ) : (
        groups.map(([muscleGroup, items]) => (
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
                    {exercise.description && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {exercise.description}
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
        ))
      )}
    </div>
  );
}
