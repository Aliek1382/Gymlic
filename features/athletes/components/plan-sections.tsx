"use client";

import { useEffect, useState } from "react";
import { Check, Circle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/get-error-message";
import { toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";
import { useToggleWorkoutDay } from "../hooks/use-toggle-workout-day";
import { useWorkoutDayLogs } from "../hooks/use-workout-day-logs";
import { NutritionPlanSections } from "./nutrition-plan-sections";
import {
  hasExerciseRows,
  parsePlanDescription,
  sectionMuscleGroups,
  techniqueLabel,
  type ParsedExerciseRow,
  type ParsedSection,
  type PlanTechnique,
} from "../utils/workout-plan-parse";
import { getTodayWeekday, headingWeekday } from "../utils/workout-plan-weekday";
import type { Weekday } from "../utils/workout-plan-text";
import type { PlanKind } from "../types/athlete-types";

// The printable sheet already lays the plan out as day blocks and exercise
// rows; this renders the same parse on screen, so an athlete doesn't have
// to export a PDF to read their program as anything but one paragraph.

const TECHNIQUE_VARIANT: Record<
  Exclude<PlanTechnique, "normal">,
  "info" | "secondary" | "warning"
> = {
  superset: "info",
  triset: "secondary",
  dropset: "warning",
};

// Shared by the column header and every straight-sets row so the two line up.
const ROW_GRID = "grid grid-cols-[1.25rem_1fr_2.25rem_2.75rem] items-center gap-x-2";

// Bordered rather than filled so the same chip reads on a row, on a muted
// day heading, and on the tinted heading of today's block. Quiet enough to
// sit on every row without competing with the exercise name.
const GROUP_CHIP =
  "shrink-0 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground";

// Resolved after mount rather than during render: the server renders in UTC
// and the athlete's browser in local time, which can disagree on which day
// it is and would trip a hydration mismatch.
function useTodayWeekday(enabled: boolean): Weekday | null {
  const [today, setToday] = useState<Weekday | null>(null);

  useEffect(() => {
    setToday(enabled ? getTodayWeekday() : null);
  }, [enabled]);

  return today;
}

function restLine(row: ParsedExerciseRow): string | null {
  const parts = [
    row.rest.betweenSets && `استراحت بین ست‌ها: ${row.rest.betweenSets}`,
    row.rest.betweenExercises && `استراحت تا حرکت بعد: ${row.rest.betweenExercises}`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" • ") : null;
}

function ExerciseRow({ row, index }: { row: ParsedExerciseRow; index: number }) {
  const label = techniqueLabel(row.technique);
  const rest = restLine(row);
  const number = toPersianDigits(index);

  if (row.technique === "normal") {
    const move = row.moves[0];
    return (
      <div className={cn(ROW_GRID, "border-t border-border py-2")}>
        <span className="text-center text-xs font-bold text-muted-foreground">
          {number}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {row.muscleGroup && (
              <span className={GROUP_CHIP}>{row.muscleGroup}</span>
            )}
            <p className="text-sm font-medium text-foreground">{move.name}</p>
          </div>
          {rest && <p className="mt-0.5 text-xs text-muted-foreground">{rest}</p>}
        </div>
        <span className="text-center text-sm font-bold text-primary">
          {row.sets ? toPersianDigits(row.sets) : "—"}
        </span>
        <span className="text-center text-sm font-bold text-primary">
          {move.reps ? toPersianDigits(move.reps) : "—"}
        </span>
      </div>
    );
  }

  // Superset / tri-set / drop-set don't fit the sets × reps columns, so they
  // take the full width under their own technique badge.
  return (
    <div className="flex items-start gap-2 border-t border-border py-2">
      <span className="w-5 shrink-0 pt-0.5 text-center text-xs font-bold text-muted-foreground">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {row.muscleGroup && (
            <span className={GROUP_CHIP}>{row.muscleGroup}</span>
          )}
          {label && (
            <Badge variant={TECHNIQUE_VARIANT[row.technique]}>{label}</Badge>
          )}
          {row.sets && (
            <Badge variant="outline">{toPersianDigits(row.sets)} دور</Badge>
          )}
          {row.drops && (
            <Badge variant="outline">
              {row.drops.map((drop) => toPersianDigits(drop)).join(" ← ")} تکرار
            </Badge>
          )}
        </div>
        <p className="mt-1 text-sm font-medium text-foreground">
          {row.moves
            .map((move) =>
              move.reps ? `${move.name} × ${toPersianDigits(move.reps)} تکرار` : move.name
            )
            .join(" + ")}
        </p>
        {rest && <p className="mt-0.5 text-xs text-muted-foreground">{rest}</p>}
      </div>
    </div>
  );
}

// A day's "انجام دادم" control, or null for a section that can't be ticked
// (no heading means no day_key to log it under, and only the plan in effect
// is tickable at all).
interface DayTick {
  done: boolean;
  pending: boolean;
  onToggle: () => void;
}

function PlanSection({
  section,
  isToday,
  tick,
}: {
  section: ParsedSection;
  isToday: boolean;
  tick: DayTick | null;
}) {
  const exerciseCount = section.rows.filter((row) => row.kind === "exercise").length;
  const groups = sectionMuscleGroups(section);
  let number = 0;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border",
        isToday && "border-primary ring-1 ring-primary/30"
      )}
    >
      {section.heading && (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2",
            isToday ? "bg-primary/10" : "bg-muted/50"
          )}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-block h-3.5 w-1 rounded-full bg-primary" />
            <h3 className="text-sm font-bold text-foreground">{section.heading}</h3>
            {groups.map((group) => (
              <span key={group} className={GROUP_CHIP}>
                {group}
              </span>
            ))}
            {isToday && <Badge variant="info">امروز</Badge>}
          </div>
          <div className="flex items-center gap-2">
            {exerciseCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {toPersianDigits(exerciseCount)} حرکت
              </span>
            )}
            {tick && (
              <Button
                size="sm"
                variant={tick.done ? "secondary" : "outline"}
                disabled={tick.pending}
                onClick={tick.onToggle}
              >
                {tick.done ? <Check /> : <Circle />}
                {tick.done ? "انجام شد" : "انجام دادم"}
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="px-3 pb-2">
        {hasExerciseRows(section) && (
          <div className={cn(ROW_GRID, "pt-2 text-xs font-medium text-muted-foreground")}>
            <span />
            <span>حرکت</span>
            <span className="text-center">ست</span>
            <span className="text-center">تکرار</span>
          </div>
        )}

        {section.rows.map((row, rowIndex) => {
          if (row.kind === "text") {
            return (
              <p
                key={rowIndex}
                className="border-t border-border py-2 text-sm leading-6 text-muted-foreground first:border-t-0"
              >
                {row.text}
              </p>
            );
          }
          number += 1;
          return <ExerciseRow key={rowIndex} row={row} index={number} />;
        })}
      </div>
    </section>
  );
}

function WorkoutPlanSections({
  planId,
  description,
  isActivePlan,
  dayLogging,
}: {
  planId: string;
  description: string | null;
  isActivePlan: boolean;
  dayLogging: boolean;
}) {
  const sections = parsePlanDescription(description);
  // A plan grouped by muscle group has no day to match against, so "today"
  // is only claimed once at least one heading names a weekday.
  const hasWeekdayHeadings = sections.some(
    (section) => headingWeekday(section.heading) !== null
  );
  const today = useTodayWeekday(isActivePlan && hasWeekdayHeadings);

  const ticksEnabled = isActivePlan && dayLogging;
  const dayLogs = useWorkoutDayLogs(ticksEnabled);
  const toggleDay = useToggleWorkoutDay(planId);

  if (sections.length === 0) return null;

  // Only headed sections are tickable — the heading is the day_key.
  const tickableHeadings = sections
    .map((section) => section.heading)
    .filter((heading): heading is string => heading !== null);

  const logIdByDay = new Map(
    (dayLogs.data ?? [])
      .filter((log) => log.assignmentId === planId)
      .map((log) => [log.dayKey, log.id])
  );

  function tickFor(heading: string | null): DayTick | null {
    if (!ticksEnabled || heading === null) return null;
    const existingLogId = logIdByDay.get(heading) ?? null;

    return {
      done: existingLogId !== null,
      // Scoped to the day actually clicked, so one in-flight tick doesn't
      // disable every other day's button.
      pending: toggleDay.isPending && toggleDay.variables?.dayKey === heading,
      onToggle: async () => {
        try {
          await toggleDay.mutateAsync({ dayKey: heading, existingLogId });
        } catch (error) {
          toast.error(getErrorMessage(error, "ثبت تمرین با خطا مواجه شد."));
        }
      },
    };
  }

  const doneThisWeek = tickableHeadings.filter((heading) =>
    logIdByDay.has(heading)
  ).length;

  const todaysSection =
    today !== null &&
    sections.some((section) => headingWeekday(section.heading) === today);

  return (
    <div className="space-y-2">
      {ticksEnabled && tickableHeadings.length > 0 && (
        <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
          این هفته: {toPersianDigits(doneThisWeek)} از{" "}
          {toPersianDigits(tickableHeadings.length)} جلسه انجام شده
        </p>
      )}

      {today !== null && !todaysSection && (
        <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
          امروز {today} است و در این برنامه تمرینی برای امروز ثبت نشده — روز استراحت.
        </p>
      )}

      {sections.map((section, index) => (
        <PlanSection
          key={index}
          section={section}
          isToday={today !== null && headingWeekday(section.heading) === today}
          tick={tickFor(section.heading)}
        />
      ))}
    </div>
  );
}

// A nutrition plan parses to meal blocks rather than day blocks, and has no
// day tick to offer, so the two kinds render through separate components.
// Dispatching here (rather than at each call site) keeps "render this plan's
// description" a single entry point.
export function PlanSections({
  planId,
  description,
  kind = "workout",
  isActivePlan = false,
  dayLogging = false,
}: {
  planId: string;
  description: string | null;
  kind?: PlanKind;
  // Only the plan actually in effect marks a day as "today" or offers a
  // tick — pointing at today's block on a finished plan would suggest it's
  // still due, and logging a session against it would be meaningless.
  isActivePlan?: boolean;
  // Ticking is workout-only; workout_day_logs references workout_assignments.
  dayLogging?: boolean;
}) {
  if (kind === "nutrition") {
    return <NutritionPlanSections description={description} />;
  }

  return (
    <WorkoutPlanSections
      planId={planId}
      description={description}
      isActivePlan={isActivePlan}
      dayLogging={dayLogging}
    />
  );
}
