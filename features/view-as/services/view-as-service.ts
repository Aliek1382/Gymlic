import { api } from "@/lib/api/client";
import { clearViewAs } from "@/lib/view-as";

/**
 * Opens a user's panel, read-only, in a new tab. The tab is opened before
 * the request so the browser counts it as the click's own window (a window
 * opened after an await is usually blocked as a popup).
 */
export async function openUserPanel(userId: string): Promise<void> {
  const tab = window.open("", "_blank");
  try {
    const { token } = await api.post<{ token: string }>(`/admin/users/${userId}/view-as`);
    if (!tab) {
      throw new Error("مرورگر جلوی باز شدن زبانهٔ تازه را گرفت. اجازهٔ پنجرهٔ بازشو را برای این سایت بدهید.");
    }
    // The token travels in the fragment, which never reaches a server log.
    tab.location.href = `${window.location.origin}/view-as/#${token}`;
  } catch (error) {
    tab?.close();
    throw error;
  }
}

/** Ends the view: its session on the server, then this tab. */
export async function endViewAs(): Promise<void> {
  await api.post("/auth/logout").catch(() => undefined);
  clearViewAs();
  window.close();
  // A tab the browser won't let a script close (opened by hand, say) goes back to the admin's own panel.
  window.location.replace("/admin/users/");
}
