import { AddFoodDialog, FoodList } from "@/features/foods";
import { RoleGate } from "@/features/authentication/components/role-gate";

export const metadata = { title: "کتابخانه غذاها | جیم‌لیک" };

export default function FoodsPage() {
  return (
    <RoleGate allow={["trainer"]}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">کتابخانه غذاها</h1>
            <p className="text-sm text-muted-foreground">
              مواد غذایی پرتکرار به‌صورت پیش‌فرض در دسترس است؛ غذاهای اختصاصی
              خودتان را هم می‌توانید اضافه کنید.
            </p>
          </div>
          <AddFoodDialog />
        </div>

        <FoodList />
      </div>
    </RoleGate>
  );
}
