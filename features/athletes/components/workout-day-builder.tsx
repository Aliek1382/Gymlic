"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ExercisePicker } from "@/features/exercises";
import { WEEKDAYS } from "../utils/workout-plan-text";

export function WorkoutDayBuilder({
  onInsertLine,
}: {
  onInsertLine: (day: string, line: string) => void;
}) {
  const [selectedDay, setSelectedDay] = useState<string>(WEEKDAYS[0]);

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          روز هفته
        </p>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((day) => (
            <Button
              key={day}
              type="button"
              size="sm"
              variant={day === selectedDay ? "default" : "outline"}
              onClick={() => setSelectedDay(day)}
            >
              {day}
            </Button>
          ))}
        </div>
      </div>

      <ExercisePicker onInsert={(line) => onInsertLine(selectedDay, line)} />
    </div>
  );
}
