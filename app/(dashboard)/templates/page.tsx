import { redirect } from "next/navigation";

import { getServerAuthContext } from "@/features/authentication/services/auth-server";
import { TemplateManager } from "@/features/athletes";

export const metadata = { title: "قالب‌ها | جیم‌لیک" };

export default async function TemplatesPage() {
  const context = await getServerAuthContext();
  if (!context) redirect("/login");
  if (context.accountType !== "trainer") redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">قالب‌ها</h1>
        <p className="text-sm text-muted-foreground">
          قالب‌های آماده برای برنامه تمرینی و غذایی بسازید تا هنگام نوشتن
          برنامه برای ورزشکاران سریع‌تر شروع کنید.
        </p>
      </div>

      <TemplateManager />
    </div>
  );
}
