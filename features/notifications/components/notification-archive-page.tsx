"use client";

import { RoleGate } from "@/features/authentication/components/role-gate";
import { useAuthContext } from "@/features/authentication/hooks/use-auth-context";
import { NotificationArchiveList } from "./notification-archive-list";

export function NotificationArchivePage() {
  const { data: context } = useAuthContext();

  return (
    <RoleGate>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">اعلان‌ها</h1>
          <p className="text-sm text-muted-foreground">
            تاریخچه‌ی کامل اعلان‌های شما.
          </p>
        </div>

        {context && <NotificationArchiveList userId={context.userId} />}
      </div>
    </RoleGate>
  );
}
