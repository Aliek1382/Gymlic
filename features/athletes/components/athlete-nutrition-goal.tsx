"use client";

import { Target } from "lucide-react";
import { toast } from "sonner";

import { Card, CardTitle } from "@/components/ui/card";
import { getErrorMessage } from "@/lib/get-error-message";
import { useUpdateAthleteNutritionGoal } from "../hooks/use-update-athlete-nutrition-goal";
import { NutritionGoalForm } from "./nutrition-goal-form";
import type { AthleteProfile } from "../types/athlete-types";

/** The trainer's view of an athlete's calorie goal — editable, for an athlete who hasn't set one. */
export function AthleteNutritionGoal({
  athleteId,
  athlete,
}: {
  athleteId: string;
  athlete: AthleteProfile;
}) {
  const updateGoal = useUpdateAthleteNutritionGoal(athleteId);

  return (
    <Card className="gap-3 py-5">
      <div className="flex items-center gap-2 px-4 sm:px-6">
        <Target className="size-4 text-muted-foreground" />
        <CardTitle className="text-base">هدف تغذیه</CardTitle>
      </div>
      <div className="space-y-3 px-4 sm:px-6">
        <p className="text-xs leading-5 text-muted-foreground">
          مقدار پیشنهادی هر غذا در برنامهٔ غذایی ساختاریافته از روی همین هدف پر
          می‌شود. ورزشکار هم می‌تواند از تنظیمات حسابش آن را ببیند و تغییر دهد.
        </p>
        <NutritionGoalForm
          // Re-seeded when a save (or the athlete) changes the stored goal.
          key={[
            athlete.dailyCalorieGoal,
            athlete.proteinPercent,
            athlete.carbsPercent,
            athlete.fatPercent,
          ].join("-")}
          initial={{
            dailyCalorieGoal: athlete.dailyCalorieGoal,
            proteinPercent: athlete.proteinPercent,
            carbsPercent: athlete.carbsPercent,
            fatPercent: athlete.fatPercent,
          }}
          isPending={updateGoal.isPending}
          onSubmit={async (values) => {
            try {
              await updateGoal.mutateAsync(values);
              toast.success("هدف تغذیه ذخیره شد.");
            } catch (error) {
              toast.error(getErrorMessage(error, "ذخیره هدف تغذیه با خطا مواجه شد."));
            }
          }}
        />
      </div>
    </Card>
  );
}
