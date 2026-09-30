"use client";

import { useSyncExternalStore } from "react";
import { CloudOff } from "lucide-react";

import { getPendingCount, subscribePendingCount } from "@/lib/offline-queue";
import { toPersianDigits } from "@/lib/persian";

/** Stays visible for as long as offline writes are waiting to be sent. */
export function OfflineQueueBadge() {
  const count = useSyncExternalStore(subscribePendingCount, getPendingCount, () => 0);
  if (count === 0) return null;

  return (
    <div
      role="status"
      className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900"
    >
      <CloudOff className="size-3.5" />
      {toPersianDigits(count)} مورد در انتظار ارسال
    </div>
  );
}
