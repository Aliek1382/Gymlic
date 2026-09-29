"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { FoodPickerItem } from "@/features/foods";
import {
  addNutritionPlanItem,
  createNutritionPlanMeal,
  deleteNutritionPlanItem,
  deleteNutritionPlanMeal,
  updateNutritionPlanItem,
  updateNutritionPlanMeal,
} from "../services/nutrition-plan-builder-service";
import type { NutritionPlanItem, NutritionPlanMeal } from "../types/nutrition-plan-builder-types";
import { nutritionPlanMealsKey } from "./use-nutrition-plan-meals";

/**
 * Everything the structured nutrition builder does to a plan's meals.
 *
 * The meals in the query cache ARE the builder's live state: structural
 * changes (add/remove) write to the server and then to the cache, while
 * field edits go to the cache first (`patchItem`, `renameMeal` — instant, so
 * totals move on the keystroke) and reach the server separately through
 * `saveItem` / `saveMeal`, which the components debounce. No call here
 * refetches, so a value still being typed is never overwritten by a reload.
 */
export function useNutritionPlanBuilder(assignmentId: string) {
  const queryClient = useQueryClient();
  const key = nutritionPlanMealsKey(assignmentId);

  function updateMeals(update: (meals: NutritionPlanMeal[]) => NutritionPlanMeal[]) {
    queryClient.setQueryData<NutritionPlanMeal[]>(key, (meals) => (meals ? update(meals) : meals));
  }

  const createMeal = useMutation({
    mutationFn: (mealName: string) => createNutritionPlanMeal(assignmentId, mealName),
    onSuccess: (created, mealName) =>
      updateMeals((meals) => [
        ...meals,
        { id: created.id, mealName, sortOrder: created.sortOrder, items: [] },
      ]),
  });

  const removeMeal = useMutation({
    mutationFn: (mealId: string) => deleteNutritionPlanMeal(assignmentId, mealId),
    onSuccess: (_, mealId) => updateMeals((meals) => meals.filter((meal) => meal.id !== mealId)),
  });

  const addItem = useMutation({
    mutationFn: (input: { mealId: string; food: FoodPickerItem; amount: number }) =>
      addNutritionPlanItem(assignmentId, input.mealId, {
        foodId: input.food.id,
        amount: input.amount,
        unit: null,
        note: null,
      }),
    onSuccess: (created, { mealId, food, amount }) => {
      // Built from the food the trainer just picked (already in memory with
      // its macros), so the row and the totals appear without a refetch.
      const item: NutritionPlanItem = {
        id: created.id,
        foodId: food.id,
        foodName: food.name,
        foodNameEn: food.nameEn,
        category: food.category,
        defaultUnit: food.defaultUnit,
        caloriesPerUnit: food.caloriesPerUnit,
        proteinG: food.proteinG,
        carbsG: food.carbsG,
        fatG: food.fatG,
        amount,
        unit: null,
        note: null,
        sortOrder: created.sortOrder,
      };
      updateMeals((meals) =>
        meals.map((meal) =>
          meal.id === mealId ? { ...meal, items: [...meal.items, item] } : meal
        )
      );
    },
  });

  const removeItem = useMutation({
    mutationFn: (input: { mealId: string; itemId: string }) =>
      deleteNutritionPlanItem(assignmentId, input.mealId, input.itemId),
    onSuccess: (_, { mealId, itemId }) =>
      updateMeals((meals) =>
        meals.map((meal) =>
          meal.id === mealId
            ? { ...meal, items: meal.items.filter((item) => item.id !== itemId) }
            : meal
        )
      ),
  });

  function patchItem(
    mealId: string,
    itemId: string,
    patch: Partial<Pick<NutritionPlanItem, "amount" | "unit" | "note">>
  ) {
    updateMeals((meals) =>
      meals.map((meal) =>
        meal.id === mealId
          ? {
              ...meal,
              items: meal.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
            }
          : meal
      )
    );
  }

  function renameMeal(mealId: string, mealName: string) {
    updateMeals((meals) =>
      meals.map((meal) => (meal.id === mealId ? { ...meal, mealName } : meal))
    );
  }

  return {
    createMeal,
    removeMeal,
    addItem,
    removeItem,
    patchItem,
    renameMeal,
    saveItem: (
      mealId: string,
      itemId: string,
      patch: Partial<{ amount: number; unit: string | null; note: string | null }>
    ) => updateNutritionPlanItem(assignmentId, mealId, itemId, patch),
    saveMeal: (mealId: string, patch: Partial<{ mealName: string }>) =>
      updateNutritionPlanMeal(assignmentId, mealId, patch),
  };
}
