"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useExercisesForPicker } from "../hooks/use-exercises-for-picker";
import { useRecordExerciseUsage } from "../hooks/use-record-exercise-usage";
import type { ExercisePickerItem } from "../types/exercise-types";

type Technique = "normal" | "superset" | "triset" | "dropset";

const TECHNIQUES: { value: Technique; label: string }[] = [
  { value: "normal", label: "عادی" },
  { value: "superset", label: "سوپرست" },
  { value: "triset", label: "تری‌ست" },
  { value: "dropset", label: "دراپ‌ست" },
];

const MULTI_LABEL: Record<"superset" | "triset", string> = {
  superset: "سوپرست",
  triset: "تری‌ست",
};

const SLOT_ORDINALS = ["اول", "دوم", "سوم"];

// Reasonable rest-interval presets for athletes — short for supersets/
// endurance work, longer for heavy compound lifts. Neither rest field has a
// default: both start on REST_NONE ("بدون تعیین") and stay optional.
const REST_NONE = "none";
const REST_OPTIONS = ["۳۰ ثانیه", "۴۵ ثانیه", "۱ دقیقه", "۹۰ ثانیه", "۲ دقیقه", "۳ دقیقه"];

function RestSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full justify-start">
        <SelectValue className="min-w-0 truncate" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={REST_NONE}>بدون تعیین</SelectItem>
        {REST_OPTIONS.map((label) => (
          <SelectItem key={label} value={label}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface Slot {
  exerciseId: string;
  reps: string;
}

function emptySlots(count: number): Slot[] {
  return Array.from({ length: count }, () => ({ exerciseId: "", reps: "" }));
}

function slotCountFor(technique: Technique): number {
  return technique === "triset" ? 3 : 2;
}

function ExerciseSelect({
  exercises,
  value,
  onChange,
  placeholder,
}: {
  exercises: ExercisePickerItem[] | undefined;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full justify-start">
        <SelectValue placeholder={placeholder} className="min-w-0 truncate" />
      </SelectTrigger>
      <SelectContent>
        {exercises?.map((exercise) => (
          <SelectItem key={exercise.id} value={exercise.id}>
            {exercise.name}
            {exercise.nameEn ? ` / ${exercise.nameEn}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ExercisePicker({
  onInsert,
}: {
  onInsert: (line: string) => void;
}) {
  const exercises = useExercisesForPicker();
  const recordUsage = useRecordExerciseUsage();

  const [technique, setTechnique] = useState<Technique>("normal");
  // exerciseId + sets + reps drive "normal"; exerciseId + drops drive
  // "dropset" — both are single-exercise techniques, so they share this
  // slice instead of the multi-exercise `slots` below.
  const [exerciseId, setExerciseId] = useState("");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [drops, setDrops] = useState<string[]>(["", ""]);
  // superset/tri-set only: one {exerciseId, reps} slot per exercise in the
  // group, sharing the same "دور" (rounds) count as `sets` above.
  const [slots, setSlots] = useState<Slot[]>(emptySlots(2));
  // Both optional, no default — only inserted into the line if a trainer
  // actually picks something. restBetweenSets doesn't apply to drop-set
  // (a drop-set is by definition no rest between drops).
  const [restBetweenSets, setRestBetweenSets] = useState(REST_NONE);
  const [restBetweenExercises, setRestBetweenExercises] = useState(REST_NONE);

  function handleTechniqueChange(next: Technique) {
    setTechnique(next);
    setExerciseId("");
    setSets("");
    setReps("");
    setDrops(["", ""]);
    setSlots(emptySlots(slotCountFor(next)));
    setRestBetweenSets(REST_NONE);
    setRestBetweenExercises(REST_NONE);
  }

  function updateSlot(index: number, patch: Partial<Slot>) {
    setSlots((current) =>
      current.map((slot, i) => (i === index ? { ...slot, ...patch } : slot))
    );
  }

  function updateDrop(index: number, value: string) {
    setDrops((current) => current.map((d, i) => (i === index ? value : d)));
  }

  function findExercise(id: string) {
    return exercises.data?.find((exercise) => exercise.id === id);
  }

  // Builds the optional "(استراحت بین ست‌ها: ..., استراحت بین حرکات: ...)"
  // suffix appended to whichever line buildEntry() produces. Empty when
  // neither rest field was set.
  function restSuffix(): string {
    const parts: string[] = [];
    if (technique !== "dropset" && restBetweenSets !== REST_NONE) {
      parts.push(`استراحت بین ست‌ها: ${restBetweenSets}`);
    }
    if (restBetweenExercises !== REST_NONE) {
      parts.push(`استراحت بین حرکات: ${restBetweenExercises}`);
    }
    return parts.length > 0 ? ` (${parts.join("، ")})` : "";
  }

  function buildEntry(): { line: string; exerciseIds: string[] } | null {
    if (technique === "normal") {
      const exercise = findExercise(exerciseId);
      const setsNum = Number(sets);
      const repsNum = Number(reps);
      if (!exercise || !(setsNum > 0) || !(repsNum > 0)) return null;
      return {
        line: `${exercise.name} — ${setsNum} ست × ${repsNum} تکرار${restSuffix()}`,
        exerciseIds: [exercise.id],
      };
    }

    if (technique === "superset" || technique === "triset") {
      const setsNum = Number(sets);
      if (!(setsNum > 0)) return null;

      const parts: string[] = [];
      const exerciseIds: string[] = [];
      for (const slot of slots) {
        const exercise = findExercise(slot.exerciseId);
        const repsNum = Number(slot.reps);
        if (!exercise || !(repsNum > 0)) return null;
        parts.push(`${exercise.name} × ${repsNum} تکرار`);
        exerciseIds.push(exercise.id);
      }

      return {
        line: `${MULTI_LABEL[technique]} (${setsNum} دور): ${parts.join(" + ")}${restSuffix()}`,
        exerciseIds,
      };
    }

    // dropset
    const exercise = findExercise(exerciseId);
    const dropNums = drops.map((d) => Number(d));
    if (!exercise || dropNums.length < 2 || dropNums.some((n) => !(n > 0))) {
      return null;
    }
    return {
      line: `${exercise.name} — دراپ‌ست: ${dropNums.join(" ← ")} تکرار (بدون استراحت، وزن کاهشی در هر افت)${restSuffix()}`,
      exerciseIds: [exercise.id],
    };
  }

  const entry = buildEntry();
  const canAdd = entry !== null;

  function handleAdd() {
    if (!entry) return;
    onInsert(entry.line);
    new Set(entry.exerciseIds).forEach((id) => recordUsage.mutate(id));

    // Clear the inputs but keep the chosen technique — a trainer adding
    // one superset is likely about to add another.
    setExerciseId("");
    setSets("");
    setReps("");
    setDrops(["", ""]);
    setSlots(emptySlots(slotCountFor(technique)));
    setRestBetweenSets(REST_NONE);
    setRestBetweenExercises(REST_NONE);
  }

  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">نوع اجرا</p>
        <div className="flex flex-wrap gap-1.5">
          {TECHNIQUES.map((t) => (
            <Button
              key={t.value}
              type="button"
              size="sm"
              variant={t.value === technique ? "default" : "outline"}
              onClick={() => handleTechniqueChange(t.value)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>

      {technique === "normal" && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            انتخاب حرکت از کتابخانه
          </p>
          <ExerciseSelect
            exercises={exercises.data}
            value={exerciseId}
            onChange={setExerciseId}
            placeholder="انتخاب حرکت..."
          />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Input
              value={sets}
              onChange={(e) => setSets(e.target.value)}
              inputMode="numeric"
              placeholder="تعداد ست"
              className="text-center sm:w-32"
            />
            <Input
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              inputMode="numeric"
              placeholder="تکرار در هر ست"
              className="text-center sm:w-32"
            />
          </div>
        </div>
      )}

      {(technique === "superset" || technique === "triset") && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            انتخاب {slots.length} حرکت برای {MULTI_LABEL[technique]}
          </p>
          {slots.map((slot, index) => (
            <div
              key={index}
              className="flex flex-col gap-2 rounded-lg bg-muted/50 p-2 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <ExerciseSelect
                  exercises={exercises.data}
                  value={slot.exerciseId}
                  onChange={(value) => updateSlot(index, { exerciseId: value })}
                  placeholder={`حرکت ${SLOT_ORDINALS[index]}...`}
                />
              </div>
              <Input
                value={slot.reps}
                onChange={(e) => updateSlot(index, { reps: e.target.value })}
                inputMode="numeric"
                placeholder="تکرار"
                className="text-center sm:w-24"
              />
            </div>
          ))}
          <Input
            value={sets}
            onChange={(e) => setSets(e.target.value)}
            inputMode="numeric"
            placeholder="تعداد دور"
            className="text-center sm:w-32"
          />
        </div>
      )}

      {technique === "dropset" && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            انتخاب حرکت برای دراپ‌ست
          </p>
          <ExerciseSelect
            exercises={exercises.data}
            value={exerciseId}
            onChange={setExerciseId}
            placeholder="انتخاب حرکت..."
          />
          <div className="space-y-2">
            {drops.map((drop, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-xs text-muted-foreground">
                  افت {index + 1}
                </span>
                <Input
                  value={drop}
                  onChange={(e) => updateDrop(index, e.target.value)}
                  inputMode="numeric"
                  placeholder="تکرار"
                  className="text-center"
                />
                {drops.length > 2 && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label="حذف افت"
                    onClick={() => setDrops((current) => current.filter((_, i) => i !== index))}
                  >
                    <Minus className="size-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setDrops((current) => [...current, ""])}
            >
              <Plus />
              افزودن افت
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          استراحت <span className="text-muted-foreground">(اختیاری)</span>
        </p>
        <div className={cn("grid gap-2", technique === "dropset" ? "grid-cols-1" : "grid-cols-2")}>
          {technique !== "dropset" && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">بین ست‌ها</p>
              <RestSelect value={restBetweenSets} onChange={setRestBetweenSets} />
            </div>
          )}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">بین حرکات</p>
            <RestSelect value={restBetweenExercises} onChange={setRestBetweenExercises} />
          </div>
        </div>
      </div>

      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!canAdd}
        onClick={handleAdd}
        className="w-full"
      >
        <Plus />
        افزودن به برنامه
      </Button>
    </div>
  );
}
