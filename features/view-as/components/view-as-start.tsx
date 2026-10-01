"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { startViewAs } from "@/lib/view-as";

/**
 * /view-as/#<token>: where the admin's "view this user's panel" lands. Keeps
 * the token for this tab only, wipes it from the address bar and history,
 * and loads the panel fresh (a full load, so nothing of the admin's own
 * session that this tab started with carries over).
 */
export function ViewAsStart() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const token = window.location.hash.slice(1);
    window.history.replaceState(null, "", window.location.pathname);
    if (!/^[0-9a-f]{64}$/.test(token)) {
      setFailed(true);
      return;
    }
    startViewAs(token);
    window.location.replace("/dashboard/");
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground">
      {failed ? (
        <p>این لینک معتبر نیست. از صفحهٔ کاربران در پنل مدیریت دوباره «دیدن پنل کاربر» را بزنید.</p>
      ) : (
        <Loader2 className="size-6 animate-spin" aria-label="در حال باز کردن پنل کاربر" />
      )}
    </div>
  );
}
