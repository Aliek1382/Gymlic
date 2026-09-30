import { PointsHistory } from "@/features/points";
import { RoleGate } from "@/features/authentication/components/role-gate";

export const metadata = { title: "امتیاز من | جیم‌لیک" };

export default function PointsPage() {
  return (
    <RoleGate allow={["trainer"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">امتیاز من</h1>
          <p className="text-sm text-muted-foreground">
            با ساخت برنامه، افزودن ورزشکار و پاسخ به تیکت‌ها امتیاز بگیرید و سطح خود را ارتقا دهید.
          </p>
        </div>

        <PointsHistory />
      </div>
    </RoleGate>
  );
}
