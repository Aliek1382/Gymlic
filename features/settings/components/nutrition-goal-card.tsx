"use client";

import { toast } from "sonner";

import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { NutritionGoalForm } from "@/features/athletes";
import type { Profile } from "@/features/authentication";
import { getErrorMessage } from "@/lib/get-error-message";
import { useUpdateNutritionGoal } from "../hooks/use-update-nutrition-goal";

/** Athlete-only: the calorie goal and macro split the trainer's food plans are sized from. */
export function NutritionGoalCard({ profile }: { profile: Profile }) {
  const updateGoal = useUpdateNutritionGoal();

  return (
    <Card className="gap-4 py-6">
      <div className="px-4 sm:px-6">
        <CardTitle className="text-base">هدف تغذیه</CardTitle>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          مربی‌تان مقدار غذاهای برنامه را از روی این هدف پیشنهاد می‌دهد. اگر نمی‌دانید
          چه عددی وارد کنید، خالی بگذارید تا مربی برایتان ثبت کند.
        </p>
      </div>
      <CardContent className="px-4 sm:px-6">
        <NutritionGoalForm
          key={[
            profile.dailyCalorieGoal,
            profile.proteinPercent,
            profile.carbsPercent,
            profile.fatPercent,
          ].join("-")}
          initial={{
            dailyCalorieGoal: profile.dailyCalorieGoal,
            proteinPercent: profile.proteinPercent,
            carbsPercent: profile.carbsPercent,
            fatPercent: profile.fatPercent,
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
      </CardContent>
    </Card>
  );
}
