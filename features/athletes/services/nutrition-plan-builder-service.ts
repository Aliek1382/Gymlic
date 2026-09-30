import { api, type ListResponse } from "@/lib/api/client";
import type { NutritionPlanItem, NutritionPlanMeal } from "../types/nutrition-plan-builder-types";

interface ItemRow {
  id: string;
  meal_id: string;
  food_id: string;
  amount: number;
  unit: string | null;
  note: string | null;
  sort_order: number;
  food_name: string;
  food_name_en: string | null;
  category: string;
  default_unit: string;
  calories_per_unit: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

interface MealRow {
  id: string;
  meal_name: string;
  sort_order: number;
  items: ItemRow[];
}

function toItem(row: ItemRow): NutritionPlanItem {
  return {
    id: row.id,
    foodId: row.food_id,
    foodName: row.food_name,
    foodNameEn: row.food_name_en,
    category: row.category,
    defaultUnit: row.default_unit,
    caloriesPerUnit: row.calories_per_unit ?? null,
    proteinG: row.protein_g ?? null,
    carbsG: row.carbs_g ?? null,
    fatG: row.fat_g ?? null,
    amount: row.amount,
    unit: row.unit,
    note: row.note,
    sortOrder: row.sort_order,
  };
}

export async function listNutritionPlanMeals(assignmentId: string): Promise<NutritionPlanMeal[]> {
  const data = await api.get<ListResponse<MealRow>>(`/plans/nutrition/${assignmentId}/meals`);
  return data.items.map((row) => ({
    id: row.id,
    mealName: row.meal_name,
    sortOrder: row.sort_order,
    items: row.items.map(toItem),
  }));
}

export async function createNutritionPlanMeal(
  assignmentId: string,
  mealName: string
): Promise<{ id: string; sortOrder: number }> {
  const data = await api.post<{ id: string; sort_order: number }>(
    `/plans/nutrition/${assignmentId}/meals`,
    { meal_name: mealName }
  );
  return { id: data.id, sortOrder: data.sort_order };
}

export async function updateNutritionPlanMeal(
  assignmentId: string,
  mealId: string,
  input: Partial<{ mealName: string; sortOrder: number }>
): Promise<void> {
  const body: Record<string, unknown> = {};
  if ("mealName" in input) body.meal_name = input.mealName;
  if ("sortOrder" in input) body.sort_order = input.sortOrder;
  await api.patch(`/plans/nutrition/${assignmentId}/meals/${mealId}`, body);
}

export async function deleteNutritionPlanMeal(assignmentId: string, mealId: string): Promise<void> {
  await api.delete(`/plans/nutrition/${assignmentId}/meals/${mealId}`);
}

export async function addNutritionPlanItem(
  assignmentId: string,
  mealId: string,
  input: { foodId: string; amount: number; unit: string | null; note: string | null }
): Promise<{ id: string; sortOrder: number }> {
  const data = await api.post<{ id: string; sort_order: number }>(
    `/plans/nutrition/${assignmentId}/meals/${mealId}/items`,
    { food_id: input.foodId, amount: input.amount, unit: input.unit, note: input.note }
  );
  return { id: data.id, sortOrder: data.sort_order };
}

export async function updateNutritionPlanItem(
  assignmentId: string,
  mealId: string,
  itemId: string,
  input: Partial<{ amount: number; unit: string | null; note: string | null }>
): Promise<void> {
  const body: Record<string, unknown> = {};
  if ("amount" in input) body.amount = input.amount;
  if ("unit" in input) body.unit = input.unit;
  if ("note" in input) body.note = input.note;
  await api.patch(`/plans/nutrition/${assignmentId}/meals/${mealId}/items/${itemId}`, body);
}

export async function deleteNutritionPlanItem(
  assignmentId: string,
  mealId: string,
  itemId: string
): Promise<void> {
  await api.delete(`/plans/nutrition/${assignmentId}/meals/${mealId}/items/${itemId}`);
}
