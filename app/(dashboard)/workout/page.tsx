import { redirect } from "next/navigation";

import { getServerAuthContext } from "@/features/authentication/services/auth-server";
import { MyPlanList } from "@/features/athletes";

export const metadata = { title: "برنامه تمرینی | جیم‌لیک" };

export default async function WorkoutPage() {
  const context = await getServerAuthContext();
  if (!context) redirect("/login");
  if (context.accountType !== "athlete") redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">برنامه تمرینی</h1>
        <p className="text-sm text-muted-foreground">
          برنامه‌های تمرینی که مربی برای شما ثبت کرده است.
        </p>
      </div>

      <MyPlanList
        kind="workout"
        emptyTitle="هنوز برنامه تمرینی ثبت نشده است."
        emptyDescription="به محض ثبت برنامه توسط مربی، اینجا نمایش داده می‌شود."
      />
    </div>
  );
}
