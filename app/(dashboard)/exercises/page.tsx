import { redirect } from "next/navigation";

import { getServerAuthContext } from "@/features/authentication/services/auth-server";
import { AddExerciseDialog, ExerciseList } from "@/features/exercises";

export const metadata = { title: "کتابخانه حرکات | جیم‌لیک" };

export default async function ExercisesPage() {
  const context = await getServerAuthContext();
  if (!context) redirect("/login");
  if (context.accountType !== "trainer") redirect("/dashboard");

  return (
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
  );
}
