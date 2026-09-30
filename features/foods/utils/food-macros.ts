import { toPersianDigits } from "@/lib/persian";
import type { FoodMacros } from "../types/food-types";

/** Calories are the anchor of every figure downstream: without them a food
 *  contributes nothing to a plan's totals, so that's what "recorded" means. */
export function hasFoodMacros(food: FoodMacros): boolean {
  return food.caloriesPerUnit !== null;
}

/** Persian digits, at most one decimal, no trailing ".0" — "۲۰۶", "۳٫۵". */
export function formatMacro(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return toPersianDigits(String(rounded)).replace(".", "٫");
}

/**
 * The short label shown next to a food's name while picking: "۲۰۶ کالری / عدد".
 * A food counted per gram would read "۱٫۷ کالری / گرم", which nobody can size a
 * portion from, so it is shown per 100 g instead: "۱۶۵ کالری / ۱۰۰ گرم".
 */
export function formatFoodCalories(food: FoodMacros & { defaultUnit: string }): string | null {
  if (food.caloriesPerUnit === null) return null;
  if (food.defaultUnit === "گرم") {
    return `${formatMacro(food.caloriesPerUnit * 100)} کالری / ${toPersianDigits(100)} گرم`;
  }
  return `${formatMacro(food.caloriesPerUnit)} کالری / ${food.defaultUnit}`;
}
