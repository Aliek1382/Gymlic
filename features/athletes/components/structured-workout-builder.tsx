"use client";

import { useMemo, useState } from "react";
import { Copy, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getErrorMessage } from "@/lib/get-error-message";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import { toPersianDigits } from "@/lib/persian";
import { useExercisesForPicker } from "@/features/exercises";
import { TechniquePicker } from "@/features/techniques";
import { getMuscleGroupBadgeVariant } from "@/features/exercises/utils/muscle-group-color";
import type { ExercisePickerItem } from "@/features/exercises/types/exercise-types";
import { useWorkoutPlanDayActions } from "../hooks/use-workout-plan-day-actions";
import { useWorkoutPlanDays } from "../hooks/use-workout-plan-days";
import { useWorkoutPlanExerciseActions } from "../hooks/use-workout-plan-exercise-actions";
import { useWorkoutPlanWeekCopy } from "../hooks/use-workout-plan-week-copy";
import type { WorkoutPlanDay, WorkoutPlanExerciseEntry } from "../types/workout-plan-builder-types";

// Every field here autosaves — there is no "ذخیره" button anywhere in this
// component. A day's name and every exercise's numbers are written straight
// to workout_plan_days / workout_plan_exercises through PlanController's
// sibling WorkoutPlanBuilderController, debounced just enough that a
// trainer typing "12" doesn't fire two requests for "1" and "12".
const SAVE_DEBOUNCE_MS = 500;

function groupByMuscle(
  exercises: ExercisePickerItem[]
): { muscleGroup: string; items: ExercisePickerItem[] }[] {
  const order: string[] = [];
  const groups = new Map<string, ExercisePickerItem[]>();
  for (const exercise of exercises) {
    if (!groups.has(exercise.muscleGroup)) {
      order.push(exercise.muscleGroup);
      groups.set(exercise.muscleGroup, []);
    }
    groups.get(exercise.muscleGroup)!.push(exercise);
  }
  return order.map((muscleGroup) => ({ muscleGroup, items: groups.get(muscleGroup)! }));
}

function parseOptionalInt(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function parseOptionalFloat(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// A label sitting above the field, not just inside it as a placeholder — a
// placeholder disappears the moment a trainer types a value, so "ست" or
// "تکرار" would otherwise vanish right when the field is at its narrowest
// and hardest to guess from the number alone.
function LabeledField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function ExerciseRow({
  assignmentId,
  dayId,
  exercise,
}: {
  assignmentId: string;
  dayId: string;
  exercise: WorkoutPlanExerciseEntry;
}) {
  const { updateExercise, removeExercise } = useWorkoutPlanExerciseActions(assignmentId);

  const [sets, setSets] = useState(exercise.sets !== null ? String(exercise.sets) : "");
  const [reps, setReps] = useState(exercise.reps ?? "");
  const [weightKg, setWeightKg] = useState(
    exercise.weightKg !== null ? String(exercise.weightKg) : ""
  );
  const [restSeconds, setRestSeconds] = useState(
    exercise.restSeconds !== null ? String(exercise.restSeconds) : ""
  );
  const [note, setNote] = useState(exercise.note ?? "");
  const [techniqueId, setTechniqueId] = useState(exercise.techniqueId);

  const save = useDebouncedCallback(
    (patch: Parameters<typeof updateExercise.mutate>[0]) => updateExercise.mutate(patch),
    SAVE_DEBOUNCE_MS
  );

  async function handleRemove() {
    try {
      await removeExercise.mutateAsync({ dayId, exerciseRowId: exercise.id });
    } catch (error) {
      toast.error(getErrorMessage(error, "حذف حرکت با خطا مواجه شد."));
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Badge variant={getMuscleGroupBadgeVariant(exercise.muscleGroup)} className="shrink-0">
            {exercise.muscleGroup}
          </Badge>
          <p className="truncate text-sm font-medium text-foreground">
            {exercise.exerciseName}
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
          aria-label="حذف حرکت"
          disabled={removeExercise.isPending}
          onClick={handleRemove}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <LabeledField label="ست">
          <Input
            value={sets}
            onChange={(e) => {
              setSets(e.target.value);
              save({ dayId, exerciseRowId: exercise.id, sets: parseOptionalInt(e.target.value) });
            }}
            inputMode="numeric"
            placeholder="مثلا 4"
            className="text-center"
          />
        </LabeledField>
        <LabeledField label="تکرار">
          <Input
            value={reps}
            onChange={(e) => {
              setReps(e.target.value);
              save({ dayId, exerciseRowId: exercise.id, reps: e.target.value || null });
            }}
            placeholder="مثلا 12-10-8"
            className="text-center"
          />
        </LabeledField>
        <LabeledField label="وزن (کیلوگرم)">
          <Input
            value={weightKg}
            onChange={(e) => {
              setWeightKg(e.target.value);
              save({
                dayId,
                exerciseRowId: exercise.id,
                weightKg: parseOptionalFloat(e.target.value),
              });
            }}
            inputMode="decimal"
            placeholder="مثلا 40"
            className="text-center"
          />
        </LabeledField>
        <LabeledField label="استراحت (ثانیه)">
          <Input
            value={restSeconds}
            onChange={(e) => {
              setRestSeconds(e.target.value);
              save({
                dayId,
                exerciseRowId: exercise.id,
                restSeconds: parseOptionalInt(e.target.value),
              });
            }}
            inputMode="numeric"
            placeholder="مثلا 60"
            className="text-center"
          />
        </LabeledField>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <LabeledField label="تکنیک">
          <TechniquePicker
            value={techniqueId}
            onChange={(next) => {
              setTechniqueId(next);
              // Not debounced: a picker change is one discrete click, and going
              // through `save` would cancel a note edit still waiting to flush.
              updateExercise.mutate({ dayId, exerciseRowId: exercise.id, techniqueId: next });
            }}
          />
        </LabeledField>
        <LabeledField label="یادداشت">
          <Input
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              save({ dayId, exerciseRowId: exercise.id, note: e.target.value || null });
            }}
            placeholder="مثلا فقط تا ست سوم"
          />
        </LabeledField>
      </div>
    </div>
  );
}

function AddExerciseForm({ assignmentId, dayId }: { assignmentId: string; dayId: string }) {
  const exercises = useExercisesForPicker();
  const { addExercise } = useWorkoutPlanExerciseActions(assignmentId);

  const [exerciseId, setExerciseId] = useState("");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [restSeconds, setRestSeconds] = useState("");
  const [techniqueId, setTechniqueId] = useState<string | null>(null);

  const groups = groupByMuscle(exercises.data ?? []);

  async function handleAdd() {
    if (!exerciseId) return;
    try {
      await addExercise.mutateAsync({
        dayId,
        exerciseId,
        sets: parseOptionalInt(sets),
        reps: reps || null,
        weightKg: parseOptionalFloat(weightKg),
        restSeconds: parseOptionalInt(restSeconds),
        note: null,
        techniqueId,
      });
      setExerciseId("");
      setSets("");
      setReps("");
      setWeightKg("");
      setRestSeconds("");
      setTechniqueId(null);
    } catch (error) {
      toast.error(getErrorMessage(error, "افزودن حرکت با خطا مواجه شد."));
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border p-2.5">
      <Select value={exerciseId} onValueChange={setExerciseId}>
        <SelectTrigger className="w-full justify-start">
          <SelectValue placeholder="انتخاب حرکت از بانک حرکات..." className="min-w-0 truncate" />
        </SelectTrigger>
        <SelectContent>
          {groups.map(({ muscleGroup, items }) => (
            <SelectGroup key={muscleGroup}>
              <SelectLabel>{muscleGroup}</SelectLabel>
              {items.map((exercise) => (
                <SelectItem key={exercise.id} value={exercise.id}>
                  {exercise.name}
                  {exercise.nameEn ? ` / ${exercise.nameEn}` : ""}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <LabeledField label="ست">
          <Input
            value={sets}
            onChange={(e) => setSets(e.target.value)}
            inputMode="numeric"
            placeholder="مثلا 4"
            className="text-center"
          />
        </LabeledField>
        <LabeledField label="تکرار">
          <Input
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            placeholder="مثلا 12-10-8"
            className="text-center"
          />
        </LabeledField>
        <LabeledField label="وزن (کیلوگرم)">
          <Input
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            inputMode="decimal"
            placeholder="مثلا 40"
            className="text-center"
          />
        </LabeledField>
        <LabeledField label="استراحت (ثانیه)">
          <Input
            value={restSeconds}
            onChange={(e) => setRestSeconds(e.target.value)}
            inputMode="numeric"
            placeholder="مثلا 60"
            className="text-center"
          />
        </LabeledField>
      </div>

      <LabeledField label="تکنیک (اختیاری)">
        <TechniquePicker value={techniqueId} onChange={setTechniqueId} />
      </LabeledField>

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full"
        disabled={!exerciseId || addExercise.isPending}
        onClick={handleAdd}
      >
        {addExercise.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
        افزودن به این روز
      </Button>
    </div>
  );
}

function CopyDayControl({
  assignmentId,
  day,
}: {
  assignmentId: string;
  day: WorkoutPlanDay;
}) {
  const { copyDay } = useWorkoutPlanDayActions(assignmentId);
  const [open, setOpen] = useState(false);
  const [weekNumber, setWeekNumber] = useState(String(day.weekNumber));
  const [dayNumber, setDayNumber] = useState(String(day.dayNumber + 1));

  async function handleCopy() {
    const week = parseOptionalInt(weekNumber);
    const dayNum = parseOptionalInt(dayNumber);
    if (!week || !dayNum) return;
    try {
      await copyDay.mutateAsync({ dayId: day.id, weekNumber: week, dayNumber: dayNum });
      toast.success("روز کپی شد.");
      setOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "کپی روز با خطا مواجه شد."));
    }
  }

  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Copy />
        کپی این روز به…
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg bg-muted/50 p-2">
      <div className="space-y-1">
        <Label className="text-xs">هفته</Label>
        <Input
          value={weekNumber}
          onChange={(e) => setWeekNumber(e.target.value)}
          inputMode="numeric"
          className="w-20 text-center"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">روز</Label>
        <Input
          value={dayNumber}
          onChange={(e) => setDayNumber(e.target.value)}
          inputMode="numeric"
          className="w-20 text-center"
        />
      </div>
      <Button type="button" size="sm" disabled={copyDay.isPending} onClick={handleCopy}>
        {copyDay.isPending && <Loader2 className="animate-spin" />}
        کپی کن
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
        انصراف
      </Button>
    </div>
  );
}

function DayCard({ assignmentId, day }: { assignmentId: string; day: WorkoutPlanDay }) {
  const { renameDay, removeDay } = useWorkoutPlanDayActions(assignmentId);
  const [dayName, setDayName] = useState(day.dayName ?? "");

  const saveDayName = useDebouncedCallback(
    (value: string) => renameDay.mutate({ dayId: day.id, dayName: value || null }),
    SAVE_DEBOUNCE_MS
  );

  async function handleRemoveDay() {
    try {
      await removeDay.mutateAsync(day.id);
    } catch (error) {
      toast.error(getErrorMessage(error, "حذف روز با خطا مواجه شد."));
    }
  }

  return (
    <CollapsibleSection
      title={`روز ${toPersianDigits(day.dayNumber)}`}
      summary={day.dayName}
      defaultOpen
    >
      <div className="space-y-3">
        <Input
          value={dayName}
          onChange={(e) => {
            setDayName(e.target.value);
            saveDayName(e.target.value);
          }}
          placeholder="نام روز (مثلا سینه و سه‌سر)"
        />

        <div className="space-y-2">
          {day.exercises.map((exercise) => (
            <ExerciseRow
              key={exercise.id}
              assignmentId={assignmentId}
              dayId={day.id}
              exercise={exercise}
            />
          ))}
        </div>

        <AddExerciseForm assignmentId={assignmentId} dayId={day.id} />

        <div className="flex flex-wrap items-center gap-2">
          <CopyDayControl assignmentId={assignmentId} day={day} />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive"
            disabled={removeDay.isPending}
            onClick={handleRemoveDay}
          >
            <Trash2 />
            حذف این روز
          </Button>
        </div>
      </div>
    </CollapsibleSection>
  );
}

function CopyWeekControl({
  assignmentId,
  weekNumber,
}: {
  assignmentId: string;
  weekNumber: number;
}) {
  const copyWeek = useWorkoutPlanWeekCopy(assignmentId);
  const [open, setOpen] = useState(false);
  const [targetWeek, setTargetWeek] = useState(String(weekNumber + 1));

  async function handleCopy() {
    const target = parseOptionalInt(targetWeek);
    if (!target) return;
    try {
      await copyWeek.mutateAsync({ sourceWeekNumber: weekNumber, targetWeekNumber: target });
      toast.success("هفته کپی شد.");
      setOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "کپی هفته با خطا مواجه شد."));
    }
  }

  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Copy />
        کپی این هفته به هفته…
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg bg-muted/50 p-2">
      <div className="space-y-1">
        <Label className="text-xs">شماره هفته مقصد</Label>
        <Input
          value={targetWeek}
          onChange={(e) => setTargetWeek(e.target.value)}
          inputMode="numeric"
          className="w-24 text-center"
        />
      </div>
      <Button type="button" size="sm" disabled={copyWeek.isPending} onClick={handleCopy}>
        {copyWeek.isPending && <Loader2 className="animate-spin" />}
        کپی کن
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
        انصراف
      </Button>
    </div>
  );
}

/**
 * The structured builder behind workout_assignments.builder_mode =
 * 'structured'. Renders once an assignment already exists (a draft row is
 * created up front so there's an id to attach days to) — every add/edit here
 * writes straight through WorkoutPlanBuilderController, so leaving this
 * dialog mid-edit loses nothing.
 */
export function StructuredWorkoutBuilder({ assignmentId }: { assignmentId: string }) {
  const days = useWorkoutPlanDays(assignmentId);
  const { createDay } = useWorkoutPlanDayActions(assignmentId);

  const existingWeeks = useMemo(() => {
    const set = new Set((days.data ?? []).map((day) => day.weekNumber));
    set.add(1);
    return [...set].sort((a, b) => a - b);
  }, [days.data]);
  const [extraWeeks, setExtraWeeks] = useState<number[]>([]);
  const weeks = useMemo(() => {
    const set = new Set([...existingWeeks, ...extraWeeks]);
    return [...set].sort((a, b) => a - b);
  }, [existingWeeks, extraWeeks]);

  const [selectedWeek, setSelectedWeek] = useState(1);

  const weekDays = (days.data ?? [])
    .filter((day) => day.weekNumber === selectedWeek)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  function handleAddWeek() {
    const next = Math.max(...weeks) + 1;
    setExtraWeeks((current) => [...current, next]);
    setSelectedWeek(next);
  }

  async function handleAddDay() {
    try {
      await createDay.mutateAsync({
        weekNumber: selectedWeek,
        dayNumber: weekDays.length + 1,
        dayName: null,
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "افزودن روز با خطا مواجه شد."));
    }
  }

  if (days.isLoading) {
    return <p className="text-sm text-muted-foreground">در حال بارگذاری برنامه...</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={String(selectedWeek)} onValueChange={(v) => setSelectedWeek(Number(v))}>
          <TabsList>
            {weeks.map((week) => (
              <TabsTrigger key={week} value={String(week)}>
                هفته {toPersianDigits(week)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button type="button" size="sm" variant="ghost" onClick={handleAddWeek}>
          <Plus />
          هفته جدید
        </Button>
      </div>

      <CopyWeekControl assignmentId={assignmentId} weekNumber={selectedWeek} />

      <div className="space-y-2">
        {weekDays.map((day) => (
          <DayCard key={day.id} assignmentId={assignmentId} day={day} />
        ))}
      </div>

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full"
        disabled={createDay.isPending}
        onClick={handleAddDay}
      >
        {createDay.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
        افزودن روز به هفته {toPersianDigits(selectedWeek)}
      </Button>
    </div>
  );
}
