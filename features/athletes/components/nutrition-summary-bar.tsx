"use client";

import { TriangleAlert } from "lucide-react";

import { formatMacro } from "@/features/foods";
import { formatNumber, toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";
import type { MacroTotals } from "../utils/nutrition-macros";
import type { NutritionGoal } from "../types/nutrition-plan-builder-types";

function IncompleteNote({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <p className="flex items-start gap-1.5 text-[11px] leading-5 text-warning">
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
      <span>
        {toPersianDigits(count)} غذا ماکروی کامل ندارد — آن بخش در جمع صفر حساب شده
      </span>
    </p>
  );
}

/**
 * Calories and macros of a meal or of the whole day, straight from the totals
 * it is handed — no state or requests of its own, so it repaints on the same
 * render as the edit that changed them.
 *
 * "day" is the prominent card (calories first, then the three macros, with
 * progress toward the athlete's goal when there is one); "meal" is the quiet
 * one-line footer under a meal. Both flag foods that aren't fully counted.
 */
export function NutritionSummaryBar({
  totals,
  variant,
  goal = null,
  className,
}: {
  totals: MacroTotals;
  variant: "day" | "meal";
  goal?: NutritionGoal | null;
  className?: string;
}) {
  if (variant === "meal") {
    return (
      <div className={cn("space-y-1 rounded-lg bg-muted/50 px-3 py-2", className)}>
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">جمع این وعده</span>
          <span className="font-bold text-primary">
            {formatNumber(totals.calories)} کالری
          </span>
          <span>پروتئین {formatMacro(totals.protein)}</span>
          <span>کربو {formatMacro(totals.carbs)}</span>
          <span>چربی {formatMacro(totals.fat)}</span>
        </p>
        <IncompleteNote count={totals.incompleteCount} />
      </div>
    );
  }

  const progress = goal ? Math.min(100, (totals.calories / goal.dailyCalories) * 100) : null;
  const over = goal !== null && totals.calories > goal.dailyCalories;

  return (
    <div className={cn("space-y-1.5 rounded-xl border border-border bg-card p-2.5 shadow-sm sm:p-3", className)}>
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="min-w-0">
          <p className="truncate text-[11px] text-muted-foreground">کالری</p>
          <p className="text-base font-bold text-primary sm:text-lg">
            {formatNumber(totals.calories)}
          </p>
        </div>
        {[
          { label: "پروتئین", value: totals.protein },
          { label: "کربو", value: totals.carbs },
          { label: "چربی", value: totals.fat },
        ].map((macro) => (
          <div key={macro.label} className="min-w-0">
            <p className="truncate text-[11px] text-muted-foreground">{macro.label}</p>
            <p className="text-sm font-semibold text-foreground sm:text-base">
              {formatMacro(macro.value)}
              <span className="text-[10px] font-normal text-muted-foreground"> g</span>
            </p>
          </div>
        ))}
      </div>

      {goal && progress !== null && (
        <div className="space-y-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", over ? "bg-warning" : "bg-primary")}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {toPersianDigits(Math.round((totals.calories / goal.dailyCalories) * 100))}٪ از هدف
            روزانه ({formatNumber(goal.dailyCalories)} کالری)
          </p>
        </div>
      )}

      <IncompleteNote count={totals.incompleteCount} />
    </div>
  );
}
