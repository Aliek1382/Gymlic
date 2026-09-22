"use client";

import { useQuery } from "@tanstack/react-query";

import { createClient } from "@/lib/supabase/client";
import { BroadcastNotificationForm } from "@/features/notifications/components/broadcast-notification-form";

export function AdminNotificationsPage() {
  const { data: clubs } = useQuery({
    queryKey: ["admin", "clubs", "names"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("clubs")
        .select("id, name")
        .order("name", { ascending: true });
      return data ?? [];
    },
  });

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
