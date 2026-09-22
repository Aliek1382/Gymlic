import { AddAthleteDialog, AthleteList } from "@/features/athletes";
import { RoleGate } from "@/features/authentication/components/role-gate";

export const metadata = { title: "ورزشکاران | جیم‌لیک" };

export default function AthletesPage() {
  return (
    <RoleGate allow={["trainer"]}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
    </RoleGate>
  );
}
