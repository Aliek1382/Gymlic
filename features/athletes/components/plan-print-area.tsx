/* eslint-disable @next/next/no-img-element -- next/image renders a
   client-side <img> wrapper with lazy loading and srcset that the print
   pipeline can't wait on; a plain <img> is what usePlanPrint blocks the
   print dialog on until it has decoded. */
import { Apple, Dumbbell, GraduationCap, User } from "lucide-react";

import { formatAge, formatPersianDate, toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";
import type { PrintablePlan } from "../hooks/use-plan-print";
import type { PlanKind } from "../types/athlete-types";
import {
  hasExerciseRows,
  parsePlanDescription,
  sectionMuscleGroups,
  techniqueLabel,
  type ParsedExerciseRow,
  type ParsedSection,
  type PlanTechnique,
} from "../utils/workout-plan-parse";
import {
  hasFoodRows,
  parseNutritionDescription,
  sectionFoodCategories,
  type ParsedFoodRow,
  type ParsedMealSection,
} from "../utils/nutrition-plan-parse";

const KIND_LABEL: Record<PlanKind, string> = {
  workout: "برنامه تمرینی",
  nutrition: "برنامه غذایی",
};

const KIND_ICON = { workout: Dumbbell, nutrition: Apple } as const;

// The sheet always prints on white paper, so every colour here is a literal
// rather than a theme token — the app's tokens flip in dark mode and would
// otherwise drag a dark background into the PDF.
const TECHNIQUE_BADGE: Record<Exclude<PlanTechnique, "normal">, string> = {
  superset: "border-[#d8c5fb] bg-[#f4ecff] text-[#6d28d9]",
  triset: "border-[#a5e8f2] bg-[#e0fafd] text-[#0e7490]",
  dropset: "border-[#fbd6ab] bg-[#fff1de] text-[#b45309]",
};

// Neutral on purpose — the muscle group sits on every row, so it stays
// quieter than the technique badges that mark the exceptions.
const GROUP_BADGE = "border-[#dfe3ee] bg-white text-[#6b7280]";

// Shared by the column header and every row, so the two stay aligned even
// though rows are separate elements (they each need their own break-inside
// rule, which a single table row set wouldn't give per-section).
const ROW_GRID = "grid grid-cols-[1.5rem_1fr_2.2rem_2.6rem_4.5rem] items-center gap-x-2";

// A food row has three columns to the exercise row's four, so it gets its
// own track sizing rather than leaving a blank column on every line.
const FOOD_ROW_GRID = "grid grid-cols-[1.5rem_1fr_4rem_5rem] items-center gap-x-2";

function InfoCard({
  label,
  name,
  meta,
  avatarUrl,
  icon: Icon,
}: {
  label: string;
  name: string;
  meta?: string | null;
  avatarUrl?: string | null;
  icon: typeof User;
}) {
  return (
    <div className="flex flex-1 items-center gap-2 rounded-lg border border-[#dfe3ee] bg-[#fafbff] px-3 py-2">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="size-9 shrink-0 rounded-full border border-[#dfe3ee] object-cover"
        />
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#dfe3ee] bg-white">
          <Icon className="size-4 text-[#3b5bfb]" />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-[7.5pt] text-[#6b7280]">{label}</p>
        <p className="truncate text-[9.5pt] font-bold text-[#111827]">{name}</p>
        {meta && <p className="text-[7.5pt] text-[#6b7280]">{meta}</p>}
      </div>
    </div>
  );
}

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-md border px-1.5 py-px text-[8pt] font-bold leading-normal",
        className
      )}
    >
      {children}
    </span>
  );
}

// The secondary note that hangs under a row — a rest interval on a workout
// sheet, a preparation note on a nutrition one — kept off the main line so
// the exercise or food itself stays scannable.
function RowNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-0.5 text-[7.5pt] text-[#8b93a5]">{children}</p>;
}

function ExerciseRow({ row, index }: { row: ParsedExerciseRow; index: number }) {
  const label = techniqueLabel(row.technique);
  const number = (
    <span className="text-center text-[8pt] font-bold text-[#9aa2b5]">
      {toPersianDigits(index)}
    </span>
  );

  if (row.technique === "normal") {
    const move = row.moves[0];
    return (
      <div className={cn(ROW_GRID, "print-row border-t border-[#eceef5] py-1.5")}>
        {number}
        <div className="min-w-0">
          <p className="truncate text-[9.5pt] font-bold text-[#111827]">
            {row.muscleGroup && (
              <Badge className={cn(GROUP_BADGE, "ml-1 font-normal")}>
                {row.muscleGroup}
              </Badge>
            )}
            {move.name}
          </p>
          {row.rest.betweenExercises && (
            <RowNote>استراحت تا حرکت بعد: {row.rest.betweenExercises}</RowNote>
          )}
        </div>
        <span className="text-center text-[9pt] font-bold text-[#3b5bfb]">
          {row.sets ? toPersianDigits(row.sets) : "—"}
        </span>
        <span className="text-center text-[9pt] font-bold text-[#3b5bfb]">
          {move.reps ? toPersianDigits(move.reps) : "—"}
        </span>
        <span className="text-center text-[8pt] text-[#6b7280]">
          {row.rest.betweenSets ?? "—"}
        </span>
      </div>
    );
  }

  // Superset / tri-set / drop-set don't fit the sets × reps columns, so they
  // take the full width under their own coloured technique badge.
  return (
    <div className={cn(ROW_GRID, "print-row items-start border-t border-[#eceef5] py-1.5")}>
      <span className="pt-0.5">{number}</span>
      <div className="col-span-4 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          {row.muscleGroup && (
            <Badge className={cn(GROUP_BADGE, "font-normal")}>{row.muscleGroup}</Badge>
          )}
          {label && (
            <Badge className={TECHNIQUE_BADGE[row.technique]}>{label}</Badge>
          )}
          {row.sets && (
            <Badge className="border-[#c8d3fd] bg-[#eef2ff] text-[#3b5bfb]">
              {toPersianDigits(row.sets)} دور
            </Badge>
          )}
          {row.drops && (
            <Badge className="border-[#c8d3fd] bg-[#eef2ff] text-[#3b5bfb]">
              {row.drops.map((drop) => toPersianDigits(drop)).join(" ← ")} تکرار
            </Badge>
          )}
        </div>
        <p className="mt-1 text-[9.5pt] font-bold text-[#111827]">
          {row.moves
            .map((move) =>
              move.reps ? `${move.name} × ${toPersianDigits(move.reps)} تکرار` : move.name
            )
            .join(" + ")}
        </p>
        {(row.rest.betweenSets || row.rest.betweenExercises) && (
          <RowNote>
            {[
              row.rest.betweenSets && `استراحت بین ست‌ها: ${row.rest.betweenSets}`,
              row.rest.betweenExercises &&
                `استراحت تا حرکت بعد: ${row.rest.betweenExercises}`,
            ]
              .filter(Boolean)
              .join(" • ")}
          </RowNote>
        )}
      </div>
    </div>
  );
}

function WorkoutSection({ section }: { section: ParsedSection }) {
  const exerciseCount = section.rows.filter((row) => row.kind === "exercise").length;
  const groups = sectionMuscleGroups(section);
  let number = 0;

  return (
    <section className="print-day mb-3 overflow-hidden rounded-lg border border-[#dfe3ee]">
      {section.heading && (
        <div className="print-day-heading flex items-center justify-between gap-2 border-b border-[#dfe3ee] bg-[#eef2ff] px-3 py-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-block h-3.5 w-1 rounded-full bg-[#3b5bfb]" />
            <h2 className="text-[10.5pt] font-bold text-[#1b2a6b]">
              {section.heading}
            </h2>
            {groups.map((group) => (
              <Badge key={group} className={cn(GROUP_BADGE, "font-normal")}>
                {group}
              </Badge>
            ))}
          </div>
          {exerciseCount > 0 && (
            <span className="text-[8pt] text-[#5566b8]">
              {toPersianDigits(exerciseCount)} حرکت
            </span>
          )}
        </div>
      )}

      <div className="px-3 pb-1.5">
        {hasExerciseRows(section) && (
          <div className={cn(ROW_GRID, "pt-1.5 text-[7.5pt] font-bold text-[#8b93a5]")}>
            <span />
            <span>حرکت</span>
            <span className="text-center">ست</span>
            <span className="text-center">تکرار</span>
            <span className="text-center">استراحت</span>
          </div>
        )}

        {section.rows.map((row, rowIndex) => {
          if (row.kind === "text") {
            return (
              <p
                key={rowIndex}
                className="print-row border-t border-[#eceef5] py-1.5 text-[9.5pt] leading-6 text-[#374151] first:border-t-0"
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

function FoodRow({ row, index }: { row: ParsedFoodRow; index: number }) {
  return (
    <div className={cn(FOOD_ROW_GRID, "print-row border-t border-[#eceef5] py-1.5")}>
      <span className="text-center text-[8pt] font-bold text-[#9aa2b5]">
        {toPersianDigits(index)}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[9.5pt] font-bold text-[#111827]">
          {row.category && (
            <Badge className={cn(GROUP_BADGE, "ml-1 font-normal")}>
              {row.category}
            </Badge>
          )}
          {row.name}
        </p>
        {row.note && <RowNote>{row.note}</RowNote>}
      </div>
      <span className="text-center text-[9pt] font-bold text-[#3b5bfb]">
        {row.amount ? toPersianDigits(row.amount) : "—"}
      </span>
      <span className="truncate text-center text-[8pt] text-[#6b7280]">
        {row.unit ?? "—"}
      </span>
    </div>
  );
}

function NutritionSection({ section }: { section: ParsedMealSection }) {
  const foodCount = section.rows.filter((row) => row.kind === "food").length;
  const categories = sectionFoodCategories(section);
  let number = 0;

  return (
    <section className="print-day mb-3 overflow-hidden rounded-lg border border-[#dfe3ee]">
      {section.heading && (
        <div className="print-day-heading flex items-center justify-between gap-2 border-b border-[#dfe3ee] bg-[#eef2ff] px-3 py-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-block h-3.5 w-1 rounded-full bg-[#3b5bfb]" />
            <h2 className="text-[10.5pt] font-bold text-[#1b2a6b]">
              {section.heading}
            </h2>
            {categories.map((category) => (
              <Badge key={category} className={cn(GROUP_BADGE, "font-normal")}>
                {category}
              </Badge>
            ))}
          </div>
          {foodCount > 0 && (
            <span className="text-[8pt] text-[#5566b8]">
              {toPersianDigits(foodCount)} مورد
            </span>
          )}
        </div>
      )}

      <div className="px-3 pb-1.5">
        {hasFoodRows(section) && (
          <div className={cn(FOOD_ROW_GRID, "pt-1.5 text-[7.5pt] font-bold text-[#8b93a5]")}>
            <span />
            <span>ماده غذایی</span>
            <span className="text-center">مقدار</span>
            <span className="text-center">واحد</span>
          </div>
        )}

        {section.rows.map((row, rowIndex) => {
          if (row.kind === "text") {
            return (
              <p
                key={rowIndex}
                className="print-row border-t border-[#eceef5] py-1.5 text-[9.5pt] leading-6 text-[#374151] first:border-t-0"
              >
                {row.text}
              </p>
            );
          }
          number += 1;
          return <FoodRow key={rowIndex} row={row} index={number} />;
        })}
      </div>
    </section>
  );
}

export function PlanPrintArea({ plan }: { plan: PrintablePlan | null }) {
  if (!plan) return null;

  const KindIcon = KIND_ICON[plan.kind];
  // Each plan kind parses to its own shape — day blocks of exercises, or
  // meal blocks of foods — so the sheet's body is built here rather than
  // rendered from one shared section list.
  const body =
    plan.kind === "nutrition"
      ? parseNutritionDescription(plan.description).map((section, index) => (
          <NutritionSection key={index} section={section} />
        ))
      : parsePlanDescription(plan.description).map((section, index) => (
          <WorkoutSection key={index} section={section} />
        ));
  const assignedLabel = formatPersianDate(new Date(plan.assignedAt));
  const athleteAge = formatAge(plan.athleteBirthDate);
  const watermarkLabel = plan.trainerName
    ? `جیم‌لیک — ${plan.trainerName}`
    : "جیم‌لیک";

  return (
    <div className="print-area hidden bg-white print:block" dir="rtl">
      {/* position: fixed (not absolute) so this repeats on every printed
          page, and rendered as real text at low opacity — not a CSS
          background — so it survives even if the browser drops background
          graphics. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center overflow-hidden"
      >
        <p className="rotate-[-30deg] whitespace-nowrap text-6xl font-bold text-black/[0.06]">
          {watermarkLabel}
        </p>
      </div>

      {/* A table wrapper is the only cross-browser way to get a running
          header and footer: Chrome and Firefox ignore @page margin boxes,
          but they do repeat <thead>/<tfoot> on every printed page — and
          unlike position:fixed banners, these reserve their own space
          instead of overlapping the content on pages two and up. */}
      <table className="print-sheet relative z-10 w-full text-[#111827]">
        <thead>
          <tr>
            <td className="pb-2">
              <div className="flex items-center justify-between gap-2 border-b-2 border-[#3b5bfb] pb-1.5">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-[#3b5bfb]">
                    <KindIcon className="size-4 text-white" />
                  </span>
                  <div>
                    <p className="text-[10pt] font-bold leading-tight">جیم‌لیک</p>
                    <p className="text-[7.5pt] leading-tight text-[#6b7280]">
                      {KIND_LABEL[plan.kind]}
                    </p>
                  </div>
                </div>
                <p className="text-[8pt] text-[#6b7280]">{assignedLabel}</p>
              </div>
            </td>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td className="align-top">
              <h1 className="mb-2 text-[14pt] font-bold leading-snug">{plan.title}</h1>

              {(plan.athleteName || plan.trainerName) && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {plan.athleteName && (
                    <InfoCard
                      label="ورزشکار"
                      name={plan.athleteName}
                      meta={athleteAge}
                      avatarUrl={plan.athleteAvatarUrl}
                      icon={User}
                    />
                  )}
                  {plan.trainerName && (
                    <InfoCard
                      label="مربی"
                      name={plan.trainerName}
                      avatarUrl={plan.trainerAvatarUrl}
                      icon={GraduationCap}
                    />
                  )}
                </div>
              )}

              {body.length > 0 ? (
                body
              ) : (
                <p className="text-[9.5pt] leading-7 text-[#374151]">
                  توضیحاتی برای این برنامه ثبت نشده است.
                </p>
              )}
            </td>
          </tr>
        </tbody>

        <tfoot>
          <tr>
            <td className="pt-2">
              <div className="flex items-center justify-between gap-2 border-t border-[#dfe3ee] pt-1.5 text-[7.5pt] text-[#8b93a5]">
                <span>{watermarkLabel}</span>
                <span>{assignedLabel}</span>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
