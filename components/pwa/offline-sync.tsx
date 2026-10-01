"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { getToken } from "@/lib/api/client";
import { refreshPendingCount } from "@/lib/offline-queue";
import { flushQueue } from "@/lib/offline-sync";
import { isViewAsTab } from "@/lib/view-as";

/**
 * Sends the offline queue when the browser comes back online, and once when
 * the app opens if something is waiting. See lib/offline-queue.ts.
 */
export function OfflineSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const flush = async () => {
      // No session, nothing to deliver; the queue is cleared at logout anyway.
      if (!getToken() || isViewAsTab()) return;
      const delivered = await flushQueue();
      if (delivered > 0) void queryClient.invalidateQueries();
    };

    void refreshPendingCount().then(() => {
      if (navigator.onLine) void flush();
    });
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [queryClient]);

  return null;
}
