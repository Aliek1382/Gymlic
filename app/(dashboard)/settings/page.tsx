import { redirect } from "next/navigation";

import { getServerAuthContext } from "@/features/authentication/services/auth-server";
import { SettingsView } from "@/features/settings";

export const metadata = { title: "تنظیمات حساب | جیم‌لیک" };

export default async function SettingsPage() {
  const context = await getServerAuthContext();
  if (!context) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">تنظیمات حساب</h1>
        <p className="text-sm text-muted-foreground">
          اطلاعات شخصی، تصویر پروفایل، ایمیل و رمز عبور خود را مدیریت کنید.
        </p>
      </div>

      <SettingsView />
    </div>
  );
}
