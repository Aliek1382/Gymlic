import { api, type ListResponse } from "@/lib/api/client";
import type { FoodPickerItem, FoodSummary } from "../types/food-types";

interface FoodRow {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  category: string;
  default_unit: string;
  created_by: string | null;
  created_at: string;
}

export async function listFoods(): Promise<FoodSummary[]> {
  const data = await api.get<ListResponse<FoodRow>>("/library/foods");

  return data.items.map((row) => ({
    id: row.id,
    name: row.name,
    nameEn: row.name_en,
    description: row.description,
    category: row.category,
    defaultUnit: row.default_unit,
    isCustom: row.created_by !== null,
    createdAt: row.created_at,
  }));
}

/** Already ordered most-used-first by the API, per trainer. */
export async function listFoodsForPicker(): Promise<FoodPickerItem[]> {
  const data = await api.get<
    ListResponse<Omit<FoodRow, "description" | "created_at"> & { usage_count: number }>
  >("/library/foods/picker");

  return data.items.map((row) => ({
    id: row.id,
    name: row.name,
    nameEn: row.name_en,
    category: row.category,
    defaultUnit: row.default_unit,
    isCustom: row.created_by !== null,
    usageCount: row.usage_count,
  }));
}

export async function recordFoodUsage(foodId: string): Promise<void> {
  await api.post(`/library/foods/${foodId}/usage`);
}

export async function createFood(input: {
  name: string;
  nameEn: string | null;
  description: string | null;
  category: string;
  defaultUnit: string;
}): Promise<{ id: string }> {
  return api.post<{ id: string }>("/library/foods", {
    name: input.name,
    name_en: input.nameEn,
    description: input.description,
    category: input.category,
    default_unit: input.defaultUnit,
  });
}
