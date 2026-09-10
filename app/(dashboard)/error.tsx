"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Panel-wide error boundary.
 *
 * Without one, a single component throwing during render replaces the whole
 * app with Next's bare "a client-side exception has occurred" — no sidebar,
 * no way back, and nothing on screen that says what broke. This keeps the
 * failure inside the page, offers a retry, and shows the message, so a bug
 * report can name the error instead of describing a white screen.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Also lands in the browser console, where the stack is still attached.
    console.error("Dashboard error boundary:", error);
  }, [error]);

  return (
    <Card className="mx-auto max-w-lg gap-4 py-8 text-center">
      <div className="flex flex-col items-center gap-3 px-6">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-5" />
        </div>
        <div className="space-y-1">
          <p className="font-medium text-foreground">این بخش با خطا مواجه شد.</p>
          <p className="text-sm text-muted-foreground">
            بقیه پنل سالم است. یک بار دوباره تلاش کنید؛ اگر خطا تکرار شد، متن
            زیر را برای پشتیبانی بفرستید.
          </p>
        </div>

        {(error.message || error.digest) && (
          <code className="max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-muted px-3 py-2 text-left text-[11px] text-muted-foreground">
            {error.message}
            {error.digest ? ` (digest: ${error.digest})` : ""}
          </code>
        )}

        <Button type="button" onClick={reset}>
          <RotateCcw />
          تلاش دوباره
        </Button>
      </div>
    </Card>
  );
}
