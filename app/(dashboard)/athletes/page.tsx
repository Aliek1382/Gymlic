import { redirect } from "next/navigation";

import { getServerAuthContext } from "@/features/authentication/services/auth-server";
import { AddAthleteDialog, AthleteList } from "@/features/athletes";

export const metadata = { title: "ورزشکاران | جیم‌لیک" };

export default async function AthletesPage() {
  const context = await getServerAuthContext();
  if (!context) redirect("/login");
  if (context.accountType !== "trainer") redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">ورزشکاران</h1>
          <p className="text-sm text-muted-foreground">
            ورزشکاران خود را اضافه کنید و برنامه تمرینی و غذایی هرکدام را
            مدیریت کنید.
          </p>
        </div>
        <AddAthleteDialog />
      </div>

      <AthleteList />
    </div>
  );
}
