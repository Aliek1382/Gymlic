"use client";

import { toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";
import {
  hasFoodRows,
  parseNutritionDescription,
  sectionFoodCategories,
  type ParsedFoodRow,
  type ParsedMealSection,
} from "../utils/nutrition-plan-parse";

// The nutrition counterpart of PlanSections: meal blocks with a row per
// food, instead of the day blocks and sets × reps rows a workout plan gets.

// The amount column is sized for a range ("۱۰۰-۱۵۰"), not just a single
// number, so a range row doesn't wrap mid-value.
const ROW_GRID = "grid grid-cols-[1.25rem_1fr_4.25rem_4rem] items-center gap-x-2";

// Same quiet bordered chip the workout sheet uses for a muscle group — it
// sits on every row, so it stays out of the food name's way.
const CATEGORY_CHIP =
  "shrink-0 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground";

function FoodRow({ row, index }: { row: ParsedFoodRow; index: number }) {
  return (
    <div className={cn(ROW_GRID, "border-t border-border py-2")}>
      <span className="text-center text-xs font-bold text-muted-foreground">
        {toPersianDigits(index)}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          {row.category && <span className={CATEGORY_CHIP}>{row.category}</span>}
          <p className="text-sm font-medium text-foreground">{row.name}</p>
        </div>
        {row.note && (
          <p className="mt-0.5 text-xs text-muted-foreground">{row.note}</p>
        )}
      </div>
      <span className="text-center text-sm font-bold text-primary">
        {row.amount ? toPersianDigits(row.amount) : "—"}
      </span>
      <span className="truncate text-center text-xs text-muted-foreground">
        {row.unit ?? "—"}
      </span>
    </div>
  );
}

function MealSection({ section }: { section: ParsedMealSection }) {
  const foodCount = section.rows.filter((row) => row.kind === "food").length;
  const categories = sectionFoodCategories(section);
  let number = 0;

  return (
    <section className="overflow-hidden rounded-xl border border-border">
      {section.heading && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/50 px-3 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-block h-3.5 w-1 rounded-full bg-primary" />
            <h3 className="text-sm font-bold text-foreground">{section.heading}</h3>
            {categories.map((category) => (
              <span key={category} className={CATEGORY_CHIP}>
                {category}
              </span>
            ))}
          </div>
          {foodCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {toPersianDigits(foodCount)} مورد
            </span>
          )}
        </div>
      )}

      <div className="px-3 pb-2">
        {hasFoodRows(section) && (
          <div className={cn(ROW_GRID, "pt-2 text-xs font-medium text-muted-foreground")}>
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
                className="border-t border-border py-2 text-sm leading-6 text-muted-foreground first:border-t-0"
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

export function NutritionPlanSections({
  description,
}: {
  description: string | null;
}) {
  const sections = parseNutritionDescription(description);
  if (sections.length === 0) return null;

  return (
    <div className="space-y-3">
      {sections.map((section, index) => (
        <MealSection key={index} section={section} />
      ))}
    </div>
  );
}
