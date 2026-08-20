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

  // With a day chosen, the day alone is the heading and the muscle group
  // tags each exercise instead — so coming back to the same day always lands
  // in that day's existing block rather than starting a rival one beside it,
  // which would read as two separate days to both the athlete and the tick.
  // With no day, the group stays the heading, so a program organised purely
  // by muscle group still gets blocks.
  const heading = selectedDay ?? selectedMuscleGroup;
  const lineMuscleGroup = selectedDay ? selectedMuscleGroup : null;

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

      <ExercisePicker
        muscleGroup={lineMuscleGroup}
        onInsert={(line) => onInsertLine(heading, line)}
      />
    </div>
  );
}
