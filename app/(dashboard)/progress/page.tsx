import { redirect } from "next/navigation";

import { getServerAuthContext } from "@/features/authentication/services/auth-server";
import { ProgressPageContent, TrainerProgressBrowser } from "@/features/progress";

export const metadata = { title: "پیشرفت | جیم‌لیک" };

export default async function ProgressPage() {
  const context = await getServerAuthContext();
  if (!context) redirect("/login");

  if (context.accountType === "trainer") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">پیشرفت ورزشکاران</h1>
          <p className="text-sm text-muted-foreground">
            یک ورزشکار را انتخاب کنید تا نمودارهای روند پیشرفت او را ببینید.
          </p>
        </div>
        <TrainerProgressBrowser />
      </div>
    );
  }

  if (context.accountType === "athlete") {
    return (
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
    );
  }

  redirect("/dashboard");
}
