"use client";

import { useQuery } from "@tanstack/react-query";

import { listNutritionPlanMeals } from "../services/nutrition-plan-builder-service";

export function nutritionPlanMealsKey(assignmentId: string) {
  return ["athletes", "nutrition-plan-meals", assignmentId];
}

export function useNutritionPlanMeals(assignmentId: string | null) {
  return useQuery({
    queryKey: nutritionPlanMealsKey(assignmentId ?? ""),
    queryFn: () => listNutritionPlanMeals(assignmentId as string),
    enabled: assignmentId !== null,
  });
}
