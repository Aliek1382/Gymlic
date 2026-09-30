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

/** "۲۰۶ کالری" — the short label shown next to a food's name while picking. */
export function formatFoodCalories(food: FoodMacros): string | null {
  return food.caloriesPerUnit === null
    ? null
    : `${formatMacro(food.caloriesPerUnit)} کالری`;
}
