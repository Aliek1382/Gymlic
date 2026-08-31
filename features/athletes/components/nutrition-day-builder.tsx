"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { FoodPicker, useFoodsForPicker } from "@/features/foods";
import { MEALS } from "../utils/nutrition-plan-text";

export function NutritionDayBuilder({
  onInsertLine,
}: {
  onInsertLine: (heading: string | null, line: string) => void;
}) {
  const foods = useFoodsForPicker();
  const [selectedMeal, setSelectedMeal] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const unique = new Set((foods.data ?? []).map((food) => food.category));
    return [...unique].sort((a, b) => a.localeCompare(b, "fa"));
  }, [foods.data]);

  function handleSelectMeal(meal: string) {
    setSelectedMeal((current) => (current === meal ? null : meal));
  }

  function handleSelectCategory(category: string) {
    setSelectedCategory((current) => (current === category ? null : category));
  }

  // Same split as WorkoutDayBuilder: with a meal chosen the meal alone is the
  // heading and the category tags each food instead, so coming back to the
  // same meal always lands in that meal's existing block rather than starting
  // a rival one beside it. With no meal, the category stays the heading.
  const heading = selectedMeal ?? selectedCategory;
  const lineCategory = selectedMeal ? selectedCategory : null;

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          وعده غذایی <span className="text-muted-foreground">(اختیاری)</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {MEALS.map((meal) => (
            <Button
              key={meal}
              type="button"
              size="sm"
              variant={meal === selectedMeal ? "default" : "outline"}
              onClick={() => handleSelectMeal(meal)}
            >
              {meal}
            </Button>
          ))}
        </div>
      </div>

      {categories.length > 0 && (
        <CollapsibleSection title="دسته غذایی (اختیاری)" summary={selectedCategory}>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((category) => (
              <Button
                key={category}
                type="button"
                size="sm"
                variant={category === selectedCategory ? "default" : "outline"}
                onClick={() => handleSelectCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>
        </CollapsibleSection>
      )}

      <FoodPicker
        category={lineCategory}
        onInsert={(line) => onInsertLine(heading, line)}
      />
    </div>
  );
}
