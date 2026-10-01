"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

import { getLastSyncedAt, subscribeLastSyncedAt } from "@/lib/sync-status";

function subscribeOnline(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

const formatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** Tells the user the screen shows saved data, and from when. */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true
  );
  const syncedAt = useSyncExternalStore(subscribeLastSyncedAt, getLastSyncedAt, () => null);
  if (online) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-xs font-medium text-amber-900"
    >
      <WifiOff className="size-3.5 shrink-0" />
      <span>
        آفلاین هستید.
        {syncedAt
          ? ` داده‌ها مربوط به آخرین همگام‌سازی (${formatter.format(syncedAt)}) است.`
          : " داده‌ای ذخیره نشده است."}
      </span>
    </div>
  );
}
