"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { ExercisePicker, useExercisesForPicker } from "@/features/exercises";
import { WEEKDAYS } from "../utils/workout-plan-text";

export function WorkoutDayBuilder({
  onInsertLine,
}: {
  onInsertLine: (heading: string | null, line: string) => void;
}) {
  const exercises = useExercisesForPicker();
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string | null>(null);

  const muscleGroups = useMemo(() => {
    const unique = new Set(
      (exercises.data ?? []).map((exercise) => exercise.muscleGroup)
    );
    return [...unique].sort((a, b) => a.localeCompare(b, "fa"));
  }, [exercises.data]);

  function handleSelectDay(day: string) {
    setSelectedDay((current) => (current === day ? null : day));
  }

  function handleSelectMuscleGroup(group: string) {
    setSelectedMuscleGroup((current) => (current === group ? null : group));
  }

  // Day and muscle group are independent — a trainer can pick either, both
  // (combined into one heading, e.g. "شنبه — پا"), or neither.
  const heading =
    [selectedDay, selectedMuscleGroup].filter(Boolean).join(" — ") || null;

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          روز هفته <span className="text-muted-foreground">(اختیاری)</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((day) => (
            <Button
              key={day}
              type="button"
              size="sm"
              variant={day === selectedDay ? "default" : "outline"}
              onClick={() => handleSelectDay(day)}
            >
              {day}
            </Button>
          ))}
        </div>
      </div>

      {muscleGroups.length > 0 && (
        <CollapsibleSection
          title="گروه عضلانی (اختیاری)"
          summary={selectedMuscleGroup}
        >
          <div className="flex flex-wrap gap-1.5">
            {muscleGroups.map((group) => (
              <Button
                key={group}
                type="button"
                size="sm"
                variant={group === selectedMuscleGroup ? "default" : "outline"}
                onClick={() => handleSelectMuscleGroup(group)}
              >
                {group}
              </Button>
            ))}
          </div>
        </CollapsibleSection>
      )}

      <ExercisePicker onInsert={(line) => onInsertLine(heading, line)} />
    </div>
  );
}
