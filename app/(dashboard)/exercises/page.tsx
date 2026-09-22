import { AddExerciseDialog, ExerciseList } from "@/features/exercises";
import { RoleGate } from "@/features/authentication/components/role-gate";

export const metadata = { title: "کتابخانه حرکات | جیم‌لیک" };

export default function ExercisesPage() {
  return (
    <RoleGate allow={["trainer"]}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">کتابخانه حرکات</h1>
            <p className="text-sm text-muted-foreground">
              حرکات پرتکرار به‌صورت پیش‌فرض در دسترس است؛ حرکت‌های اختصاصی خودتان
              را هم می‌توانید اضافه کنید.
            </p>
          </div>
          <AddExerciseDialog />
        </div>

        <ExerciseList />
      </div>
    </RoleGate>
  );
}
