import { Loader2 } from "lucide-react";

/**
 * Shown while a layout resolves the session. On a static host every protected
 * page is served as the same signed-out HTML shell, so this is what a visitor
 * sees for the moment between hydration and the auth context coming back.
 */
export function RouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
      <span className="sr-only">در حال بارگذاری…</span>
    </div>
  );
}
