import { createClient } from "@/lib/supabase/client";
import type { FoodPickerItem, FoodSummary } from "../types/food-types";

async function getCurrentUserId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("نشست کاربر معتبر نیست.");
  return user.id;
}

export async function listFoods(): Promise<FoodSummary[]> {
  const supabase = createClient();
  await getCurrentUserId();

  const { data, error } = await supabase
    .from("foods")
    .select(
      "id, name, name_en, description, category, default_unit, created_by, created_at"
    )
    .order("name", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => ({
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

export async function listFoodsForPicker(): Promise<FoodPickerItem[]> {
  const supabase = createClient();
  const trainerId = await getCurrentUserId();

  const [foodsResult, usageResult] = await Promise.all([
    supabase
      .from("foods")
      .select("id, name, name_en, category, default_unit, created_by"),
    supabase
      .from("food_usage")
      .select("food_id, use_count")
      .eq("trainer_id", trainerId),
  ]);
  if (foodsResult.error) throw foodsResult.error;
  if (usageResult.error) throw usageResult.error;

  const usageByFood = new Map(
    (usageResult.data ?? []).map((row) => [row.food_id, row.use_count])
  );

  return (foodsResult.data ?? [])
    .map((row) => ({
      id: row.id,
      name: row.name,
      nameEn: row.name_en,
      category: row.category,
      defaultUnit: row.default_unit,
      isCustom: row.created_by !== null,
      usageCount: usageByFood.get(row.id) ?? 0,
    }))
    .sort(
      (a, b) => b.usageCount - a.usageCount || a.name.localeCompare(b.name, "fa")
    );
}

export async function recordFoodUsage(foodId: string): Promise<void> {
  const supabase = createClient();
  const trainerId = await getCurrentUserId();

  const { data: existing, error: selectError } = await supabase
    .from("food_usage")
    .select("id, use_count")
    .eq("trainer_id", trainerId)
    .eq("food_id", foodId)
    .maybeSingle();
  if (selectError) throw selectError;

  if (existing) {
    const { error } = await supabase
      .from("food_usage")
      .update({
        use_count: existing.use_count + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("food_usage").insert({
    trainer_id: trainerId,
    food_id: foodId,
    use_count: 1,
  });
  if (error) throw error;
}

export async function createFood(input: {
  name: string;
  nameEn: string | null;
  description: string | null;
  category: string;
  defaultUnit: string;
}): Promise<{ id: string }> {
  const supabase = createClient();
  const trainerId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("foods")
    .insert({
      name: input.name,
      name_en: input.nameEn,
      description: input.description,
      category: input.category,
      default_unit: input.defaultUnit,
      created_by: trainerId,
    })
    .select("id")
    .single();
  if (error) throw error;

  return { id: data.id };
}
