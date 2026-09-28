import { CalendarPageContent } from "@/features/calendar";
import { RoleGate } from "@/features/authentication/components/role-gate";

export const metadata = { title: "تقویم | جیم‌لیک" };

export default function CalendarPage() {
  return (
    <RoleGate allow={["trainer"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">تقویم</h1>
          <p className="text-sm text-muted-foreground">
            جلسات خصوصی زمان‌بندی‌شده به‌صورت خودکار اینجا دیده می‌شوند؛ یادآوری‌ها و
            جلسه‌های دیگرتان را هم دستی اضافه کنید. این تقویم فقط برای خودتان است.
          </p>
        </div>

        <CalendarPageContent />
      </div>
    </RoleGate>
  );
}
