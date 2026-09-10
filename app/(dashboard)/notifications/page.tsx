import { redirect } from "next/navigation";

import { getServerAuthContext } from "@/features/authentication/services/auth-server";
import { NotificationArchiveList } from "@/features/notifications";

export const metadata = { title: "اعلان‌ها | جیم‌لیک" };

export default async function NotificationsPage() {
  const context = await getServerAuthContext();
  if (!context) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">اعلان‌ها</h1>
        <p className="text-sm text-muted-foreground">
          تاریخچه‌ی کامل اعلان‌های شما.
        </p>
      </div>

      <NotificationArchiveList userId={context.userId} />
    </div>
  );
}
