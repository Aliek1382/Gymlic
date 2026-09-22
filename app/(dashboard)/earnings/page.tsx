import { EarningsPageContent } from "@/features/earnings";
import { RoleGate } from "@/features/authentication/components/role-gate";

export const metadata = { title: "درآمد من | جیم‌لیک" };

export default function EarningsPage() {
  return (
    <RoleGate allow={["trainer"]}>
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
    </RoleGate>
  );
}
