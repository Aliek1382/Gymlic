import { createClient } from "@/lib/supabase/server";
import { BroadcastNotificationForm } from "@/features/notifications/components/broadcast-notification-form";

export const metadata = { title: "اعلان همگانی | پنل مدیریت جیم‌لیک" };

export default async function AdminNotificationsPage() {
  const supabase = await createClient();

  const { data: clubs } = await supabase
    .from("clubs")
    .select("id, name")
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">اعلان همگانی</h1>
        <p className="text-sm text-muted-foreground">
          پیام به همه کاربران جیم‌لیک یا فقط اعضای باشگاه‌های مشخص ارسال کنید.
        </p>
      </div>

      <BroadcastNotificationForm clubs={clubs ?? []} />
    </div>
  );
}
