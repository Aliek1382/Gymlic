"use client";

import { useMemo } from "react";

import { computeNutritionTotals, type NutritionTotals } from "../utils/nutrition-macros";
import type { NutritionPlanMeal } from "../types/nutrition-plan-builder-types";

/**
 * Per-meal and whole-day calories and macros for the meals as they are right
 * now. Pure: it sums the array it is given and makes no request, so passing
 * it the live meals (the builder keeps them in the query cache and edits them
 * there before the save round-trip) makes every total update on the keystroke.
 */
export function useNutritionTotals(meals: NutritionPlanMeal[]): NutritionTotals {
  return useMemo(() => computeNutritionTotals(meals), [meals]);
}
