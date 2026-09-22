"use client";

import { useEffect, useState } from "react";

/**
 * The single param value every dynamic route in this app is keyed by is the
 * last path segment (`/join/<code>`, `/athletes/<id>`, `/admin/clubs/<id>`…).
 *
 * Under `output: "export"` those routes are emitted once, as a placeholder
 * shell, because the real ids only exist at runtime. The host rewrites every
 * concrete URL onto that shell without changing the address bar, so the page
 * recovers its own parameter from the URL here.
 *
 * Returns null on the first render — the shell is prerendered at build time
 * where there is no `window`, so reading the URL has to wait for mount, and
 * callers render their loading state until it resolves.
 */
export function useRouteParam(): string | null {
  const [param, setParam] = useState<string | null>(null);

  useEffect(() => {
    const segments = window.location.pathname
      .split("/")
      .filter((segment) => segment.length > 0);
    const last = segments[segments.length - 1];
    setParam(last ? decodeURIComponent(last) : null);
  }, []);

  return param;
}
