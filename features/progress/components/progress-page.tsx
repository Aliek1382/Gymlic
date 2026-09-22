"use client";

import { RoleGate } from "@/features/authentication/components/role-gate";
import { useAuthContext } from "@/features/authentication/hooks/use-auth-context";
import { ProgressPageContent } from "./progress-page-content";
import { TrainerProgressBrowser } from "./trainer-progress-browser";

export function ProgressPage() {
  const { data: context } = useAuthContext();

  return (
    <RoleGate allow={["trainer", "athlete"]}>
      {context?.accountType === "trainer" ? (
        <div className="space-y-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">پیشرفت ورزشکاران</h1>
            <p className="text-sm text-muted-foreground">
              یک ورزشکار را انتخاب کنید تا نمودارهای روند پیشرفت او را ببینید.
            </p>
          </div>
          <TrainerProgressBrowser />
        </div>
      ) : context?.accountType === "athlete" ? (
        <div className="space-y-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">پیشرفت</h1>
            <p className="text-sm text-muted-foreground">
              روند وزن، BMI، درصد چربی بدن، دور کمر و دور سینه‌ی خودتان را
              دنبال کنید.
            </p>
          </div>
          <ProgressPageContent athleteId={context.userId} />
        </div>
      ) : null}
    </RoleGate>
  );
}
