import { SettingsView } from "@/features/settings";
import { RoleGate } from "@/features/authentication/components/role-gate";

export const metadata = { title: "پروفایل | جیم‌لیک" };

export default function ProfilePage() {
  return (
    <RoleGate allow={["athlete"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">پروفایل</h1>
          <p className="text-sm text-muted-foreground">
            اطلاعات شخصی، تصویر پروفایل، ایمیل و رمز عبور خود را مدیریت کنید.
          </p>
        </div>

        <SettingsView />
      </div>
    </RoleGate>
  );
}
