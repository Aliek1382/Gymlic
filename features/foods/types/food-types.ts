/**
 * Calories and macros are per ONE `defaultUnit` of the food (defaultUnit
 * "۱۰۰ گرم" means these figures are for 100 g). Null means nobody has entered
 * the figure yet — never "zero" — so a plan can flag the food as incomplete
 * instead of silently under-counting it.
 */
export interface FoodMacros {
  caloriesPerUnit: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

export interface FoodSummary extends FoodMacros {
  id: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  category: string;
  defaultUnit: string;
  isCustom: boolean;
  createdAt: string;
}

export interface FoodPickerItem extends FoodMacros {
  id: string;
  name: string;
  nameEn: string | null;
  category: string;
  defaultUnit: string;
  isCustom: boolean;
  usageCount: number;
}
