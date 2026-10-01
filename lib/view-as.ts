/**
 * "View as this user": a super admin opens a user's panel in a new tab, on a
 * read-only session the API created for that (see
 * AdminUsersController::viewAs). The token lives in that tab's
 * sessionStorage only, so the admin's own session (localStorage) keeps
 * working in every other tab, and closing the tab ends the view.
 *
 * In a view tab nothing is written locally either: no offline snapshot of
 * the user's data (lib/query-persist.ts), no offline queue, and the admin's
 * own stored session and push subscription are never touched.
 *
 * This file must not import lib/api/client.ts (which imports it).
 */

const STORAGE_KEY = "gymlic.viewAs";

export function getViewAsToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function isViewAsTab(): boolean {
  return getViewAsToken() !== null;
}

/** Called by /view-as with the token from its URL fragment. */
export function startViewAs(token: string): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Without sessionStorage the view can't run; /view-as says so.
  }
}

export function clearViewAs(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
