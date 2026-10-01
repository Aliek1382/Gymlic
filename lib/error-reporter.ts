/**
 * Sends what breaks in a user's browser to the admin's error log
 * (/admin/errors; see backend-php/src/ErrorLog.php), so a white screen on
 * someone's phone shows up in the panel instead of nowhere.
 *
 * Each message is sent once per page load and at most a handful per load;
 * noise from browser extensions and the browser itself is dropped, and so
 * are API errors (the server records its own side of those).
 */

import { ApiError, getApiBaseUrl } from "@/lib/api/client";
import { getViewAsToken } from "@/lib/view-as";

const TOKEN_KEY = "gymlic.token";
const MAX_PER_LOAD = 10;
const IGNORE = [/ResizeObserver loop/i, /^Script error\.?$/i, /chrome-extension:|moz-extension:|safari-extension:/i];

const sent = new Set<string>();

function token(): string | null {
  // A view of a user's panel only reads; its report goes unattached.
  if (getViewAsToken()) return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function reportError(error: unknown, location?: string): void {
  if (typeof window === "undefined" || error instanceof ApiError) return;

  const err = error instanceof Error ? error : null;
  const message = (err ? `${err.name}: ${err.message}` : String(error)).slice(0, 1000);
  const stack = err?.stack?.slice(0, 4000) ?? null;
  if (!message || IGNORE.some((pattern) => pattern.test(message) || (stack && pattern.test(stack)))) return;
  if (sent.has(message) || sent.size >= MAX_PER_LOAD) return;
  sent.add(message);

  let base: string;
  try {
    base = getApiBaseUrl();
  } catch {
    return;
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const auth = token();
  if (auth) headers.Authorization = `Bearer ${auth}`;

  void fetch(`${base}/client-errors`, {
    method: "POST",
    headers,
    keepalive: true,
    body: JSON.stringify({ message, stack, location: location ?? null, url: window.location.pathname }),
  }).catch(() => undefined);
}

/** Uncaught errors and unhandled promise rejections, page-wide. Returns an uninstall. */
export function installErrorReporter(): () => void {
  const onError = (event: ErrorEvent) => {
    const where = event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined;
    if (where && IGNORE.some((pattern) => pattern.test(where))) return;
    reportError(event.error ?? event.message, where);
  };
  const onRejection = (event: PromiseRejectionEvent) => reportError(event.reason, "unhandled promise rejection");
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
