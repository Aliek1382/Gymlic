"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseLocaleNumber, toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

export interface NutritionGoalValues {
  dailyCalorieGoal: number | null;
  proteinPercent: number | null;
  carbsPercent: number | null;
  fatPercent: number | null;
}

const MIN_CALORIES = 500;
const MAX_CALORIES = 20000;

const toText = (value: number | null) => (value === null ? "" : String(value));

/**
 * The athlete's daily calorie goal and protein/carbs/fat split. Shared by the
 * athlete's own settings and by the trainer's athlete page (who can fill it
 * in for an athlete who hasn't). Validation mirrors the API: the three
 * percentages are all filled and add up to 100, or all left empty.
 */
export function NutritionGoalForm({
  initial,
  isPending,
  onSubmit,
}: {
  initial: NutritionGoalValues;
  isPending: boolean;
  onSubmit: (values: NutritionGoalValues) => Promise<void> | void;
}) {
  const [calories, setCalories] = useState(toText(initial.dailyCalorieGoal));
  const [protein, setProtein] = useState(toText(initial.proteinPercent));
  const [carbs, setCarbs] = useState(toText(initial.carbsPercent));
  const [fat, setFat] = useState(toText(initial.fatPercent));
  const [error, setError] = useState<string | null>(null);

  const percentTexts = [protein, carbs, fat];
  const filled = percentTexts.filter((text) => text.trim() !== "");
  const sum = percentTexts.reduce((total, text) => total + (parseLocaleNumber(text) ?? 0), 0);
  const showSum = filled.length > 0;

  function validate(): NutritionGoalValues | null {
    const dailyCalorieGoal = parseLocaleNumber(calories);
    if (calories.trim() !== "") {
      if (
        dailyCalorieGoal === null ||
        !Number.isInteger(dailyCalorieGoal) ||
        dailyCalorieGoal < MIN_CALORIES ||
        dailyCalorieGoal > MAX_CALORIES
      ) {
        setError(`هدف کالری باید عددی صحیح بین ${toPersianDigits(MIN_CALORIES)} تا ${toPersianDigits("20,000")} باشد.`);
        return null;
      }
    }

    const percents = percentTexts.map((text) => parseLocaleNumber(text));
    if (filled.length !== 0 && filled.length !== 3) {
      setError("هر سه درصد پروتئین، کربوهیدرات و چربی را وارد کنید، یا هر سه را خالی بگذارید.");
      return null;
    }
    if (percents.some((p) => p !== null && (!Number.isInteger(p) || p < 0 || p > 100))) {
      setError("درصدها باید عددی صحیح بین ۰ تا ۱۰۰ باشند.");
      return null;
    }
    if (filled.length === 3 && sum !== 100) {
      setError(`مجموع سه درصد باید ۱۰۰ باشد (الان ${toPersianDigits(sum)}).`);
      return null;
    }

    return {
      dailyCalorieGoal,
      proteinPercent: percents[0],
      carbsPercent: percents[1],
      fatPercent: percents[2],
    };
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const values = validate();
    if (!values) return;
    setError(null);
    await onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="goal-calories">هدف کالری روزانه</Label>
        <Input
          id="goal-calories"
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
          inputMode="numeric"
          placeholder="مثلاً ۲۲۰۰"
          className="text-center"
        />
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { id: "goal-protein", label: "پروتئین", value: protein, set: setProtein },
            { id: "goal-carbs", label: "کربوهیدرات", value: carbs, set: setCarbs },
            { id: "goal-fat", label: "چربی", value: fat, set: setFat },
          ].map((field) => (
            <div key={field.id} className="min-w-0 space-y-1.5">
              <Label htmlFor={field.id} className="truncate text-xs">
                {field.label} (٪)
              </Label>
              <Input
                id={field.id}
                value={field.value}
                onChange={(e) => field.set(e.target.value)}
                inputMode="numeric"
                placeholder="۰"
                className="px-2 text-center"
              />
            </div>
          ))}
        </div>
        {showSum && (
          <p
            className={cn(
              "text-xs",
              sum === 100 && filled.length === 3 ? "text-success" : "text-muted-foreground"
            )}
          >
            مجموع درصدها: {toPersianDigits(sum)} از ۱۰۰
          </p>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
        {isPending && <Loader2 className="animate-spin" />}
        ذخیره هدف تغذیه
      </Button>
    </form>
  );
}
