export interface NutritionPlanItem {
  id: string;
  foodId: string;
  foodName: string;
  foodNameEn: string | null;
  category: string;
  defaultUnit: string;
  // Per ONE defaultUnit of the food; null = never entered (see FoodMacros).
  caloriesPerUnit: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  amount: number;
  // Null means "the food's own defaultUnit" — the only unit the macros above
  // are valid for.
  unit: string | null;
  note: string | null;
  sortOrder: number;
}

export interface NutritionPlanMeal {
  id: string;
  mealName: string;
  sortOrder: number;
  items: NutritionPlanItem[];
}

/** The athlete's daily calorie goal and how it splits across macros (percents add up to 100). */
export interface NutritionGoal {
  dailyCalories: number;
  proteinPercent: number;
  carbsPercent: number;
  fatPercent: number;
}
