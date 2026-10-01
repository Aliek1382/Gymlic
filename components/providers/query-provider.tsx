"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { restoreQueries, startPersistingQueries } from "@/lib/query-persist";
import { setLastSyncedAt } from "@/lib/sync-status";

// Persisted entries must outlive the default 5-minute garbage collection, or
// they would drop out of the next snapshot while nothing is observing them.
const GC_TIME_MS = 24 * 60 * 60 * 1000;

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            gcTime: GC_TIME_MS,
            refetchOnWindowFocus: false,
            retry: 1,
            // Try the request even when the browser reports offline (and keep
            // the data already held if it fails) instead of pausing forever.
            networkMode: "offlineFirst",
          },
          // Offline writes must reach api.queueable (lib/offline-queue.ts)
          // rather than sit paused until the browser is back online.
          mutations: { networkMode: "always" },
        },
      })
  );
  const [restored, setRestored] = React.useState(false);

  React.useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;

    // Restoring before the first render of the panel means a screen opened
    // offline already has its data, and a fresh fetch can't be overwritten by
    // an older snapshot arriving late.
    void restoreQueries(queryClient).then((savedAt) => {
      if (cancelled) return;
      if (savedAt) setLastSyncedAt(savedAt);
      stop = startPersistingQueries(queryClient, setLastSyncedAt);
      setRestored(true);
    });

    return () => {
      cancelled = true;
      stop?.();
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {restored ? children : null}
    </QueryClientProvider>
  );
}
