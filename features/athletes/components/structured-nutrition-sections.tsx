"use client";

import { formatMacro } from "@/features/foods";
import { formatNumber, toPersianDigits } from "@/lib/persian";
import { useNutritionPlanMeals } from "../hooks/use-nutrition-plan-meals";
import { useNutritionTotals } from "../hooks/use-nutrition-totals";
import { itemIssue, itemMacros, itemUnit } from "../utils/nutrition-macros";
import type { NutritionPlanItem, NutritionPlanMeal } from "../types/nutrition-plan-builder-types";
import { NutritionSummaryBar } from "./nutrition-summary-bar";

// Same quiet category chip the text-plan sheet uses.
const CATEGORY_CHIP =
  "shrink-0 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground";

function FoodRow({ item }: { item: NutritionPlanItem }) {
  const macros = itemMacros(item);
  const counted = itemIssue(item) !== "unit-mismatch" && item.caloriesPerUnit !== null;

  return (
    <div className="grid grid-cols-[1fr_auto] items-start gap-x-3 border-t border-border py-2 first:border-t-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={CATEGORY_CHIP}>{item.category}</span>
          <p className="text-sm font-medium text-foreground">{item.foodName}</p>
        </div>
        {item.note && <p className="mt-0.5 text-xs text-muted-foreground">{item.note}</p>}
      </div>
      <div className="text-left">
        <p className="text-sm font-bold text-primary">
          {toPersianDigits(item.amount)}{" "}
          <span className="text-xs font-normal text-muted-foreground">{itemUnit(item)}</span>
        </p>
        <p className="text-[11px] text-muted-foreground">
          {counted ? `${formatNumber(macros.calories)} کالری` : "—"}
        </p>
      </div>
    </div>
  );
}

function MealSection({
  meal,
  totals,
}: {
  meal: NutritionPlanMeal;
  totals: ReturnType<typeof useNutritionTotals>["byMeal"][string];
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/50 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-1 rounded-full bg-primary" />
          <h3 className="text-sm font-bold text-foreground">{meal.mealName}</h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {toPersianDigits(meal.items.length)} مورد
        </span>
      </div>

      <div className="px-3">
        {meal.items.map((item) => (
          <FoodRow key={item.id} item={item} />
        ))}
      </div>

      <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {formatNumber(totals.calories)} کالری
        </span>
        {" · "}پروتئین {formatMacro(totals.protein)} · کربو {formatMacro(totals.carbs)} · چربی{" "}
        {formatMacro(totals.fat)}
      </div>
    </section>
  );
}

/**
 * A structured nutrition plan as the athlete (or the trainer previewing it)
 * reads it: meal blocks, a row per food with its amount and calories, and the
 * totals — read from nutrition_plan_meals rather than parsed from description.
 */
export function StructuredNutritionSections({ planId }: { planId: string }) {
  const meals = useNutritionPlanMeals(planId);
  const totals = useNutritionTotals(meals.data ?? []);
  // A meal the trainer added but never put a food in is just noise to read.
  const list = (meals.data ?? []).filter((meal) => meal.items.length > 0);

  if (meals.isLoading) {
    return <p className="text-sm text-muted-foreground">در حال بارگذاری برنامه...</p>;
  }
  if (meals.isError) {
    return <p className="text-sm text-destructive">دریافت برنامه غذایی با خطا مواجه شد.</p>;
  }
  if (list.length === 0) return null;

  return (
    <div className="space-y-3">
      <NutritionSummaryBar variant="day" totals={totals.day} />
      {list.map((meal) => (
        <MealSection key={meal.id} meal={meal} totals={totals.byMeal[meal.id]} />
      ))}
    </div>
  );
}
