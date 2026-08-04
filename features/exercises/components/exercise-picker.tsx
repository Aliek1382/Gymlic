"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useExercisesForPicker } from "../hooks/use-exercises-for-picker";
import { useRecordExerciseUsage } from "../hooks/use-record-exercise-usage";

export function ExercisePicker({
  onInsert,
}: {
  onInsert: (line: string) => void;
}) {
  const exercises = useExercisesForPicker();
  const recordUsage = useRecordExerciseUsage();
  const [exerciseId, setExerciseId] = useState("");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");

  const selected = exercises.data?.find((exercise) => exercise.id === exerciseId);
  const setsNum = Number(sets);
  const repsNum = Number(reps);
  const canAdd = Boolean(selected) && setsNum > 0 && repsNum > 0;

  function handleAdd() {
    if (!selected || !canAdd) return;

    onInsert(`${selected.name} — ${setsNum} ست × ${repsNum} تکرار`);
    recordUsage.mutate(selected.id);

    setExerciseId("");
    setSets("");
    setReps("");
  }

  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <p className="text-xs font-medium text-muted-foreground">
        انتخاب حرکت از کتابخانه
      </p>

      <Select value={exerciseId} onValueChange={setExerciseId}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="انتخاب حرکت..." />
        </SelectTrigger>
        <SelectContent>
          {exercises.data?.map((exercise) => (
            <SelectItem key={exercise.id} value={exercise.id}>
              {exercise.name}
              {exercise.nameEn ? ` / ${exercise.nameEn}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={sets}
          onChange={(e) => setSets(e.target.value)}
          inputMode="numeric"
          placeholder="تعداد ست"
          className="w-24 text-center"
        />
        <Input
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          inputMode="numeric"
          placeholder="تکرار در هر ست"
          className="w-28 text-center"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canAdd}
          onClick={handleAdd}
          className="flex-1 sm:flex-none"
        >
          <Plus />
          افزودن به برنامه
        </Button>
      </div>
    </div>
  );
}
