import { toast } from "sonner";

import { getApiBaseUrl } from "@/lib/api/client";
import { isQueued, peek, refreshPendingCount, remove, update } from "@/lib/offline-queue";

// A server error or a flaky connection is retried on the next flush; this
// many failed attempts and the record is dropped rather than retried forever.
const MAX_RETRIES = 5;

let flushing = false;

/**
 * Replays the queue oldest-first with each record's own stored token.
 * Returns how many records were delivered. Stops at the first network
 * failure and leaves the rest untouched for the next `online` event.
 */
export async function flushQueue(): Promise<number> {
  if (flushing || typeof navigator === "undefined") return 0;
  flushing = true;
  let delivered = 0;

  try {
    // Two open tabs would otherwise both send the same record.
    const run = async () => {
      for (;;) {
        // Re-read every round: a logout mid-flush empties the store and the
        // loop must see that rather than keep sending from a stale list.
        const record = await peek();
        if (!record) return;

        const headers: Record<string, string> = {};
        if (record.token) headers.Authorization = `Bearer ${record.token}`;
        if (record.body !== undefined) headers["Content-Type"] = "application/json";

        let response: Response;
        try {
          response = await fetch(`${getApiBaseUrl()}${record.url}`, {
            method: record.method,
            headers,
            body: record.body !== undefined ? JSON.stringify(record.body) : undefined,
          });
        } catch {
          return; // still offline
        }

        if (response.ok) {
          await remove(record.id);
          delivered += 1;
        } else if (response.status === 401) {
          await remove(record.id);
          toast.error("یک تغییر آفلاین شما به‌خاطر پایان نشست ارسال نشد.");
        } else if (response.status >= 400 && response.status < 500) {
          await remove(record.id);
          toast.error("یک تغییر آفلاین شما توسط سرور پذیرفته نشد و ارسال نشد.");
        } else {
          // 5xx: transient. Keep the record, stop, try again later.
          if (record.retries + 1 >= MAX_RETRIES) {
            await remove(record.id);
            toast.error("یک تغییر آفلاین شما پس از چند بار تلاش ارسال نشد.");
            continue;
          }
          await update({ ...record, retries: record.retries + 1 });
          return;
        }
      }
    };

    if (navigator.locks) {
      await navigator.locks.request("gymlic-offline-flush", run);
    } else {
      await run();
    }
  } catch {
    // IndexedDB failure: leave the queue as it is.
  } finally {
    flushing = false;
    await refreshPendingCount();
  }

  return delivered;
}

/**
 * For a mutation's onSuccess: tells the user a write was stored for later
 * instead of sent. Returns true when it was queued, so the caller can skip
 * refetching (offline, it would only fail) and any "saved" message.
 */
export function notifyIfQueued(result: unknown): boolean {
  if (!isQueued(result)) return false;
  toast.info("آفلاین ذخیره شد، به‌محض اتصال ارسال می‌شود.");
  return true;
}
