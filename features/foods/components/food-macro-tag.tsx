import { TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatFoodCalories, hasFoodMacros } from "../utils/food-macros";
import type { FoodMacros } from "../types/food-types";

/**
 * A small tag beside a food's name: its calories per default unit, or — when
 * the figures were never entered — a quiet warning, so a trainer sees at
 * pick time that this food will count as zero in the plan's totals.
 */
export function FoodMacroTag({
  food,
  className,
}: {
  food: FoodMacros & { defaultUnit: string };
  className?: string;
}) {
  if (!hasFoodMacros(food)) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded bg-warning-muted px-1.5 py-0.5 text-[10px] font-medium text-warning",
          className
        )}
      >
        <TriangleAlert className="size-3" />
        مقدار ماکرو ثبت نشده
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground",
        className
      )}
    >
      {formatFoodCalories(food)}
    </span>
  );
}
