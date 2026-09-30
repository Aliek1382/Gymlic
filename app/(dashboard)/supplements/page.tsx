import { AddSupplementDialog, SupplementList } from "@/features/supplements";
import { RoleGate } from "@/features/authentication/components/role-gate";

export const metadata = { title: "کتابخانه مکمل‌ها | جیم‌لیک" };

export default function SupplementsPage() {
  return (
    <RoleGate allow={["trainer"]}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">کتابخانه مکمل‌ها</h1>
            <p className="text-sm text-muted-foreground">
              مکمل‌های پرمصرف به‌صورت پیش‌فرض در دسترس است؛ مکمل‌های اختصاصی
              خودتان را هم می‌توانید اضافه کنید.
            </p>
          </div>
          <AddSupplementDialog />
        </div>

        <SupplementList />
      </div>
    </RoleGate>
  );
}
