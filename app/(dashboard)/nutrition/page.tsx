import { redirect } from "next/navigation";

import { getServerAuthContext } from "@/features/authentication/services/auth-server";
import { MyPlanList } from "@/features/athletes";

export const metadata = { title: "برنامه غذایی | جیم‌لیک" };

export default async function NutritionPage() {
  const context = await getServerAuthContext();
  if (!context) redirect("/login");
  if (context.accountType !== "athlete") redirect("/dashboard");

  const athleteName =
    [context.firstName, context.lastName].filter(Boolean).join(" ") || null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">برنامه غذایی</h1>
        <p className="text-sm text-muted-foreground">
          برنامه‌های غذایی که مربی برای شما ثبت کرده است.
        </p>
      </div>

      <MyPlanList
        kind="nutrition"
        emptyTitle="هنوز برنامه غذایی ثبت نشده است."
        emptyDescription="به محض ثبت برنامه توسط مربی، اینجا نمایش داده می‌شود."
        currentUserId={context.userId}
        athleteName={athleteName}
        athleteBirthDate={context.birthDate}
        athleteAvatarUrl={context.avatarUrl}
        trainerName={context.trainerName}
        trainerAvatarUrl={context.trainerAvatarUrl}
      />
    </div>
  );
}
