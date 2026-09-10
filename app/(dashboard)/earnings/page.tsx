import { redirect } from "next/navigation";

import { getServerAuthContext } from "@/features/authentication/services/auth-server";
import { EarningsPageContent } from "@/features/earnings";

export const metadata = { title: "درآمد من | جیم‌لیک" };

export default async function EarningsPage() {
  const context = await getServerAuthContext();
  if (!context) redirect("/login");
  if (context.accountType !== "trainer") redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">درآمد من</h1>
        <p className="text-sm text-muted-foreground">
          شهریه‌هایی که از شاگردانتان دریافت کرده‌اید را ثبت کنید و روند درآمد
          خود را دنبال کنید. این اطلاعات فقط برای خودتان قابل مشاهده است.
        </p>
      </div>

      <EarningsPageContent />
    </div>
  );
}
