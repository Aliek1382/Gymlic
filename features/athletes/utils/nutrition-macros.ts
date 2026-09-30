import type {
  NutritionGoal,
  NutritionPlanItem,
  NutritionPlanMeal,
} from "../types/nutrition-plan-builder-types";

// Pure arithmetic over data that is already in memory — nothing here fetches.
// Every total on screen (per meal, per day, the live preview) is derived from
// the same meals array by these functions, so they can't disagree.

export interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  // How many foods are not fully counted (see itemIssue). Surfaced in the UI
  // so an under-counted total is visibly incomplete, never silently wrong.
  incompleteCount: number;
}

export const EMPTY_TOTALS: MacroTotals = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  incompleteCount: 0,
};

export type ItemIssue = "no-macros" | "unit-mismatch";

/** The unit an item is actually measured in. */
export function itemUnit(item: NutritionPlanItem): string {
  return item.unit ?? item.defaultUnit;
}

/**
 * Why an item's figures can't be trusted, or null when it counts in full.
 * - "unit-mismatch": the trainer picked a unit other than the one the food's
 *   macros are recorded for. There is no conversion between units, so it adds
 *   nothing rather than a wrong number.
 * - "no-macros": at least one of calories/protein/carbs/fat was never entered;
 *   those figures count as zero.
 */
export function itemIssue(item: NutritionPlanItem): ItemIssue | null {
  if (itemUnit(item) !== item.defaultUnit) return "unit-mismatch";
  if (
    item.caloriesPerUnit === null ||
    item.proteinG === null ||
    item.carbsG === null ||
    item.fatG === null
  ) {
    return "no-macros";
  }
  return null;
}

export function itemMacros(item: NutritionPlanItem): MacroTotals {
  const issue = itemIssue(item);
  if (issue === "unit-mismatch") return { ...EMPTY_TOTALS, incompleteCount: 1 };

  return {
    calories: (item.caloriesPerUnit ?? 0) * item.amount,
    protein: (item.proteinG ?? 0) * item.amount,
    carbs: (item.carbsG ?? 0) * item.amount,
    fat: (item.fatG ?? 0) * item.amount,
    incompleteCount: issue === null ? 0 : 1,
  };
}

export function sumMacros(items: NutritionPlanItem[]): MacroTotals {
  return items.reduce<MacroTotals>((total, item) => {
    const macros = itemMacros(item);
    return {
      calories: total.calories + macros.calories,
      protein: total.protein + macros.protein,
      carbs: total.carbs + macros.carbs,
      fat: total.fat + macros.fat,
      incompleteCount: total.incompleteCount + macros.incompleteCount,
    };
  }, EMPTY_TOTALS);
}

export interface NutritionTotals {
  byMeal: Record<string, MacroTotals>;
  day: MacroTotals;
}

export function computeNutritionTotals(meals: NutritionPlanMeal[]): NutritionTotals {
  const byMeal: Record<string, MacroTotals> = {};
  const all: NutritionPlanItem[] = [];
  for (const meal of meals) {
    byMeal[meal.id] = sumMacros(meal.items);
    all.push(...meal.items);
  }
  return { byMeal, day: sumMacros(all) };
}

interface FoodForSuggestion {
  defaultUnit: string;
  caloriesPerUnit: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

// What a plan with no better answer is assumed to have: usually three or more
// meals. Dividing the day by however many meals exist *right now* would hand
// the first food of a new plan the whole day's share (800 g of rice), so the
// builder starts from this and lets the trainer state the real number.
export const DEFAULT_MEALS_PER_DAY = 3;

// Energy per gram — used only to tell which macro a food mostly is.
const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

/**
 * A starting amount for a food, in its default unit, from the athlete's goal:
 *
 *   share of the day's calories for the food's dominant macro
 *     ÷ meals per day            (one meal's slice, not the whole day's)
 *     ÷ calories per unit of the food
 *
 * "Dominant" is the macro contributing the most calories per unit (protein
 * for chicken, carbs for rice, fat for olive oil). It is only a suggestion the
 * trainer edits — a linear rule of thumb, not a nutrition engine — and is null
 * whenever it can't be worked out honestly: no goal, no per-unit calories, or
 * no gram figures to tell what the food mostly is.
 */
export function suggestAmount(
  food: FoodForSuggestion,
  goal: NutritionGoal | null,
  mealsPerDay: number
): number | null {
  if (!goal || food.caloriesPerUnit === null || food.caloriesPerUnit <= 0) return null;

  const energy = {
    protein: (food.proteinG ?? 0) * KCAL_PER_GRAM.protein,
    carbs: (food.carbsG ?? 0) * KCAL_PER_GRAM.carbs,
    fat: (food.fatG ?? 0) * KCAL_PER_GRAM.fat,
  };
  const dominant = (Object.keys(energy) as (keyof typeof energy)[]).reduce((best, key) =>
    energy[key] > energy[best] ? key : best
  );
  if (energy[dominant] <= 0) return null;

  const percent = {
    protein: goal.proteinPercent,
    carbs: goal.carbsPercent,
    fat: goal.fatPercent,
  }[dominant];

  const targetCalories = (goal.dailyCalories * percent) / 100 / Math.max(1, mealsPerDay);
  return roundAmount(targetCalories / food.caloriesPerUnit);
}

// Quarter-steps while the amount is small (1.25 of "100 گرم"), whole numbers
// once it isn't — nobody weighs 187.3 g.
function roundAmount(amount: number): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const rounded = amount < 10 ? Math.round(amount * 4) / 4 : Math.round(amount);
  return Math.max(0.25, rounded);
}

/** Null unless the athlete has a calorie goal and a full macro split. */
export function toNutritionGoal(input: {
  dailyCalorieGoal: number | null;
  proteinPercent: number | null;
  carbsPercent: number | null;
  fatPercent: number | null;
}): NutritionGoal | null {
  if (
    !input.dailyCalorieGoal ||
    input.proteinPercent === null ||
    input.carbsPercent === null ||
    input.fatPercent === null
  ) {
    return null;
  }
  return {
    dailyCalories: input.dailyCalorieGoal,
    proteinPercent: input.proteinPercent,
    carbsPercent: input.carbsPercent,
    fatPercent: input.fatPercent,
  };
}
